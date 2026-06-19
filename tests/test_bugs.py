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


if __name__ == "__main__":
    test_bug_upsert_and_promote()
    print("test_bug_upsert_and_promote: OK")