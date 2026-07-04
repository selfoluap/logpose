"""Tests for lg sentry resolve/unresolve (stdlib only, no network)."""

import argparse
import contextlib
import os
import tempfile
from io import StringIO

from logpose import cli
from logpose.db import bug_add, bug_get, get_db, project_add, task_add


def run_sentry_status(db_path, config, bug_id, status="resolved", token="tok", put=None):
    orig_get_db = cli.get_db
    orig_load_config = cli.load_config
    orig_put = cli._put_sentry_issue_status
    old_token = os.environ.get("SENTRY_AUTH_TOKEN")

    try:
        cli.get_db = lambda: get_db(db_path)
        cli.load_config = lambda: config
        calls = []

        def fake_put(org, issue_id, token, sentry_status):
            calls.append((org, issue_id, token, sentry_status))
            if put:
                put(org, issue_id, token, sentry_status)

        cli._put_sentry_issue_status = fake_put
        if token is None:
            os.environ.pop("SENTRY_AUTH_TOKEN", None)
        else:
            os.environ["SENTRY_AUTH_TOKEN"] = token

        out = StringIO()
        with contextlib.redirect_stdout(out):
            cli.cmd_sentry_issue_status(argparse.Namespace(id=bug_id, sentry_status=status))
        return out.getvalue(), calls
    finally:
        cli.get_db = orig_get_db
        cli.load_config = orig_load_config
        cli._put_sentry_issue_status = orig_put
        if old_token is None:
            os.environ.pop("SENTRY_AUTH_TOKEN", None)
        else:
            os.environ["SENTRY_AUTH_TOKEN"] = old_token


def make_bug(db_path, source_url="https://sentry.io/organizations/acme/issues/12345/", status="promoted", task_id=None):
    conn = get_db(db_path)
    project = project_add(conn, "demo", "/tmp/demo")
    bug = bug_add(conn, project["id"], "Boom", source_url=source_url)
    if task_id == "new":
        task_id = task_add(conn, project["id"], "Fix Boom")["id"]
    if status != bug["status"] or task_id is not None:
        conn.execute("UPDATE bugs SET status = ?, task_id = ? WHERE id = ?", (status, task_id, bug["id"]))
        conn.commit()
    conn.close()
    return bug["id"]


def test_sentry_resolve_updates_sentry_only():
    with tempfile.NamedTemporaryFile() as f:
        bug_id = make_bug(f.name, status="promoted", task_id="new")

        out, calls = run_sentry_status(f.name, {"sentry": {"org": "acme"}}, bug_id)

        assert calls == [("acme", "12345", "tok", "resolved")]
        assert "Resolved Sentry issue #12345 (Boom)" in out

        conn = get_db(f.name)
        bug = bug_get(conn, bug_id)
        assert bug["status"] == "promoted"
        assert bug["task_id"] is not None
        conn.close()


def test_sentry_unresolve_sets_unresolved():
    with tempfile.NamedTemporaryFile() as f:
        bug_id = make_bug(f.name)

        out, calls = run_sentry_status(f.name, {"sentry": {"org": "acme"}}, bug_id, status="unresolved")

        assert calls == [("acme", "12345", "tok", "unresolved")]
        assert "Unresolved Sentry issue #12345 (Boom)" in out


def test_sentry_resolve_rejects_missing_or_invalid_source_url():
    for source_url in (None, "https://example.com/nope"):
        with tempfile.NamedTemporaryFile() as f:
            bug_id = make_bug(f.name, source_url=source_url)
            try:
                run_sentry_status(f.name, {"sentry": {"org": "acme"}}, bug_id)
            except SystemExit as e:
                assert e.code == 1
            else:
                assert False, "expected SystemExit"


def test_sentry_resolve_reports_http_errors():
    def fail(org, issue_id, token, status):
        raise RuntimeError("HTTP 403")

    with tempfile.NamedTemporaryFile() as f:
        bug_id = make_bug(f.name)
        try:
            run_sentry_status(f.name, {"sentry": {"org": "acme"}}, bug_id, put=fail)
        except SystemExit as e:
            assert e.code == 1
        else:
            assert False, "expected SystemExit"


def test_put_sentry_issue_status_uses_put_json_request():
    orig_urlopen = cli.urllib.request.urlopen
    seen = {}

    class Response:
        def __enter__(self):
            return self

        def __exit__(self, *args):
            return False

        def read(self):
            return b"{}"

    def fake_urlopen(req, timeout):
        seen["url"] = req.full_url
        seen["method"] = req.get_method()
        seen["data"] = req.data
        seen["auth"] = req.headers["Authorization"]
        seen["content_type"] = req.headers["Content-type"]
        seen["timeout"] = timeout
        return Response()

    try:
        cli.urllib.request.urlopen = fake_urlopen
        cli._put_sentry_issue_status("acme inc", "12345", "tok", "resolved")
    finally:
        cli.urllib.request.urlopen = orig_urlopen

    assert seen["url"] == "https://sentry.io/api/0/organizations/acme%20inc/issues/12345/"
    assert seen["method"] == "PUT"
    assert seen["data"] == b'{"status": "resolved"}'
    assert seen["auth"] == "Bearer tok"
    assert seen["content_type"] == "application/json"
    assert seen["timeout"] == 30


if __name__ == "__main__":
    test_sentry_resolve_updates_sentry_only()
    test_sentry_unresolve_sets_unresolved()
    test_sentry_resolve_rejects_missing_or_invalid_source_url()
    test_sentry_resolve_reports_http_errors()
    test_put_sentry_issue_status_uses_put_json_request()
    print("all tests OK")
