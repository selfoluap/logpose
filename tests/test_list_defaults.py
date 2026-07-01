"""Tests: list commands show only open items by default, --all restores full list."""

import argparse
import contextlib
from io import StringIO
import tempfile

from logpose.db import (
    get_db, project_add,
    idea_add, idea_update,
    task_add, task_update,
    bug_add, bug_update,
    brain_add, brain_update,
)
from logpose import cli


def run_with_db(db_path, fn, args):
    orig_get_db = cli.get_db
    try:
        cli.get_db = lambda: get_db(db_path)
        out = StringIO()
        with contextlib.redirect_stdout(out):
            fn(args)
        return out.getvalue()
    finally:
        cli.get_db = orig_get_db


def test_idea_list_defaults_to_open_and_all_restores_current_behavior():
    with tempfile.NamedTemporaryFile() as f:
        conn = get_db(f.name)
        project = project_add(conn, "demo", "/tmp/demo")
        idea_add(conn, project["id"], "new idea")
        refined = idea_add(conn, project["id"], "refined idea")
        converted = idea_add(conn, project["id"], "converted idea")
        idea_update(conn, refined["id"], status="refined")
        idea_update(conn, converted["id"], status="converted")
        conn.close()

        out = run_with_db(f.name, cli.cmd_idea_list, argparse.Namespace(project=None, status=None, all=False))
        assert "Showing 2 open of 3 total. Use --all to see all." in out
        assert "new idea" in out
        assert "refined idea" in out
        assert "converted idea" not in out

        out = run_with_db(f.name, cli.cmd_idea_list, argparse.Namespace(project=None, status=None, all=True))
        assert "converted idea" in out
        assert "Showing" not in out


def test_task_list_defaults_to_not_done_and_all_restores_current_behavior():
    with tempfile.NamedTemporaryFile() as f:
        conn = get_db(f.name)
        project = project_add(conn, "demo", "/tmp/demo")
        pending = task_add(conn, project["id"], "pending task")
        planned = task_add(conn, project["id"], "planned task")
        in_progress = task_add(conn, project["id"], "in_progress task")
        blocked = task_add(conn, project["id"], "blocked task")
        done = task_add(conn, project["id"], "done task")
        task_update(conn, planned["id"], status="planned")
        task_update(conn, in_progress["id"], status="in_progress")
        task_update(conn, blocked["id"], status="blocked")
        task_update(conn, done["id"], status="done")
        conn.close()

        out = run_with_db(f.name, cli.cmd_task_list, argparse.Namespace(project=None, status=None, all=False))
        assert "Showing 4 open of 5 total. Use --all to see all." in out
        assert "pending task" in out
        assert "planned task" in out
        assert "in_progress task" in out
        assert "blocked task" in out
        assert "done task" not in out

        out = run_with_db(f.name, cli.cmd_task_list, argparse.Namespace(project=None, status=None, all=True))
        assert "done task" in out
        assert "Showing" not in out


def test_bug_list_defaults_to_open_and_all_restores_current_behavior():
    with tempfile.NamedTemporaryFile() as f:
        conn = get_db(f.name)
        project = project_add(conn, "demo", "/tmp/demo")
        new_bug = bug_add(conn, project["id"], "new bug")
        confirmed = bug_add(conn, project["id"], "confirmed bug")
        promoted = bug_add(conn, project["id"], "promoted bug")
        bug_update(conn, confirmed["id"], status="confirmed")
        bug_update(conn, promoted["id"], status="promoted")
        conn.close()

        out = run_with_db(f.name, cli.cmd_bug_list, argparse.Namespace(project=None, status=None, all=False))
        assert "Showing 2 open of 3 total. Use --all to see all." in out
        assert "new bug" in out
        assert "confirmed bug" in out
        assert "promoted bug" not in out

        out = run_with_db(f.name, cli.cmd_bug_list, argparse.Namespace(project=None, status=None, all=True))
        assert "promoted bug" in out
        assert "Showing" not in out


def test_brain_list_defaults_to_open_and_all_restores_current_behavior():
    with tempfile.NamedTemporaryFile() as f:
        conn = get_db(f.name)
        new_b = brain_add(conn, "new brain")
        exploring = brain_add(conn, "exploring brain")
        done_b = brain_add(conn, "done brain")
        abandoned = brain_add(conn, "abandoned brain")
        brain_update(conn, exploring["id"], status="exploring")
        brain_update(conn, done_b["id"], status="done")
        brain_update(conn, abandoned["id"], status="abandoned")
        conn.close()

        out = run_with_db(f.name, cli.cmd_brain_list, argparse.Namespace(tag=None, status=None, all=False))
        assert "Showing 2 open of 4 total. Use --all to see all." in out
        assert "new brain" in out
        assert "exploring brain" in out
        assert "done brain" not in out
        assert "abandoned brain" not in out

        out = run_with_db(f.name, cli.cmd_brain_list, argparse.Namespace(tag=None, status=None, all=True))
        assert "done brain" in out
        assert "abandoned brain" in out
        assert "Showing" not in out


def test_status_filter_does_not_add_default_open_summary():
    with tempfile.NamedTemporaryFile() as f:
        conn = get_db(f.name)
        project = project_add(conn, "demo", "/tmp/demo")
        done = task_add(conn, project["id"], "done task")
        task_update(conn, done["id"], status="done")
        conn.close()

        out = run_with_db(f.name, cli.cmd_task_list, argparse.Namespace(project=None, status="done", all=False))
        assert "done task" in out
        assert "Showing" not in out


if __name__ == "__main__":
    test_idea_list_defaults_to_open_and_all_restores_current_behavior()
    test_task_list_defaults_to_not_done_and_all_restores_current_behavior()
    test_bug_list_defaults_to_open_and_all_restores_current_behavior()
    test_brain_list_defaults_to_open_and_all_restores_current_behavior()
    test_status_filter_does_not_add_default_open_summary()
    print("all tests OK")
