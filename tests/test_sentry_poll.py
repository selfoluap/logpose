"""Tests for lg sentry poll (stdlib only, no network)."""

import argparse
import contextlib
import os
import tempfile
from io import StringIO

from logpose import cli
from logpose.db import get_db, project_add, bug_list


def run_poll(db_path, config, issues, token="tok"):
    orig_get_db = cli.get_db
    orig_load_config = cli.load_config
    orig_fetch = cli._fetch_sentry_issues
    old_token = os.environ.get("SENTRY_AUTH_TOKEN")

    try:
        cli.get_db = lambda: get_db(db_path)
        cli.load_config = lambda: config
        cli._fetch_sentry_issues = lambda org, project, token: issues
        if token is None:
            os.environ.pop("SENTRY_AUTH_TOKEN", None)
        else:
            os.environ["SENTRY_AUTH_TOKEN"] = token

        out = StringIO()
        with contextlib.redirect_stdout(out):
            cli.cmd_sentry_poll(argparse.Namespace())
        return out.getvalue()
    finally:
        cli.get_db = orig_get_db
        cli.load_config = orig_load_config
        cli._fetch_sentry_issues = orig_fetch
        if old_token is None:
            os.environ.pop("SENTRY_AUTH_TOKEN", None)
        else:
            os.environ["SENTRY_AUTH_TOKEN"] = old_token


def test_sentry_poll_no_mappings_exits_cleanly():
    with tempfile.NamedTemporaryFile() as f:
        out = run_poll(f.name, {"sentry": {"org": "acme", "projects": {}}}, [])
        assert "No Sentry project mappings configured" in out


def test_sentry_poll_requires_token():
    with tempfile.NamedTemporaryFile() as f:
        try:
            run_poll(
                f.name,
                {"sentry": {"org": "acme", "projects": {"api": "demo"}}},
                [],
                token=None,
            )
        except SystemExit as e:
            assert e.code == 1
        else:
            assert False, "expected SystemExit"


def test_sentry_poll_requires_org():
    with tempfile.NamedTemporaryFile() as f:
        try:
            run_poll(
                f.name,
                {"sentry": {"org": None, "projects": {"api": "demo"}}},
                [],
            )
        except SystemExit as e:
            assert e.code == 1
        else:
            assert False, "expected SystemExit"


def test_sentry_poll_creates_then_updates_by_permalink():
    issue = {
        "title": "Boom",
        "culprit": "app.views",
        "permalink": "https://sentry/issues/1",
        "count": "2",
        "firstSeen": "2026-01-01T00:00:00Z",
        "lastSeen": "2026-01-01T00:05:00Z",
        "level": "error",
    }

    with tempfile.NamedTemporaryFile() as f:
        conn = get_db(f.name)
        project_add(conn, "demo", "/tmp/demo")
        conn.close()

        config = {"sentry": {"org": "acme", "projects": {"api": "demo"}}}

        out = run_poll(f.name, config, [issue])
        assert "1 created, 0 updated" in out

        issue["count"] = "5"
        issue["lastSeen"] = "2026-01-01T00:10:00Z"
        out = run_poll(f.name, config, [issue])
        assert "0 created, 1 updated" in out

        conn = get_db(f.name)
        bugs = bug_list(conn)
        assert len(bugs) == 1
        assert bugs[0]["source_url"] == "https://sentry/issues/1"
        assert bugs[0]["count"] == 5
        assert bugs[0]["last_seen"] == "2026-01-01T00:10:00Z"
        conn.close()


def test_sentry_poll_reports_project_errors_and_continues():
    orig_fetch = cli._fetch_sentry_issues

    def fake_fetch(org, project, token):
        if project == "bad":
            raise RuntimeError("timeout")
        return [{
            "title": "Boom",
            "permalink": f"https://sentry/issues/1",
            "count": 1,
        }]

    with tempfile.NamedTemporaryFile() as f:
        conn = get_db(f.name)
        project_add(conn, "demo", "/tmp/demo")
        conn.close()

        config = {"sentry": {"org": "acme", "projects": {"bad": "demo", "good": "demo"}}}
        orig_get_db = cli.get_db
        orig_load_config = cli.load_config
        old_token = os.environ.get("SENTRY_AUTH_TOKEN")

        try:
            cli.get_db = lambda: get_db(f.name)
            cli.load_config = lambda: config
            cli._fetch_sentry_issues = fake_fetch
            os.environ["SENTRY_AUTH_TOKEN"] = "tok"

            out = StringIO()
            with contextlib.redirect_stdout(out):
                try:
                    cli.cmd_sentry_poll(argparse.Namespace())
                except SystemExit:
                    pass
            output = out.getvalue()
        finally:
            cli.get_db = orig_get_db
            cli.load_config = orig_load_config
            cli._fetch_sentry_issues = orig_fetch
            if old_token is None:
                os.environ.pop("SENTRY_AUTH_TOKEN", None)
            else:
                os.environ["SENTRY_AUTH_TOKEN"] = old_token

        assert "timeout" in output
        conn = get_db(f.name)
        assert len(bug_list(conn)) == 1
        conn.close()


if __name__ == "__main__":
    test_sentry_poll_no_mappings_exits_cleanly()
    test_sentry_poll_requires_token()
    test_sentry_poll_requires_org()
    test_sentry_poll_creates_then_updates_by_permalink()
    test_sentry_poll_reports_project_errors_and_continues()
    print("all tests OK")
