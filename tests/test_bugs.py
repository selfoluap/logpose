"""Smoke test for the bug entity and upsert/promote behaviour (stdlib only)."""

import tempfile

from logpose.db import (
    get_db, project_add, bug_add, bug_list, bug_update, task_add
)


def test_bug_upsert_and_promote():
    with tempfile.NamedTemporaryFile() as f:
        conn = get_db(f.name)
        project = project_add(conn, "demo", "/tmp/demo")

        bug = bug_add(conn, project["id"], "Boom", source_url="https://sentry/issues/1", count=2)
        same = bug_add(conn, project["id"], "Boom again", source_url="https://sentry/issues/1", count=5)

        assert bug["id"] == same["id"]
        assert same["count"] == 5
        assert len(bug_list(conn, project_id=project["id"])) == 1

        task = task_add(conn, project["id"], same["title"], description=same["description"])
        promoted = bug_update(conn, same["id"], status="promoted", task_id=task["id"])

        assert promoted["status"] == "promoted"
        assert promoted["task_id"] == task["id"]

        conn.close()


def test_graph_shows_bug_count():
    """cmd_graph prints bug count when a project is specified."""
    import sys
    from io import StringIO
    import argparse

    with tempfile.NamedTemporaryFile() as f:
        db_path = f.name
        conn = get_db(db_path)
        proj = project_add(conn, "graphtest", "/tmp/graphtest")
        bug_add(conn, proj["id"], "Bug 1")
        bug_add(conn, proj["id"], "Bug 2")
        conn.close()

        from logpose import db as db_mod
        orig = db_mod.DEFAULT_DB_PATH
        db_mod.DEFAULT_DB_PATH = db_path

        from logpose.cli import cmd_graph
        args = argparse.Namespace(project="graphtest", format="ascii")

        import contextlib
        captured = StringIO()
        with contextlib.redirect_stdout(captured):
            cmd_graph(args)

        db_mod.DEFAULT_DB_PATH = orig

        output = captured.getvalue()
        assert "Bugs: 2" in output, f"Expected 'Bugs: 2' in output, got: {output}"


if __name__ == "__main__":
    test_bug_upsert_and_promote()
    test_graph_shows_bug_count()
    print("all tests OK")