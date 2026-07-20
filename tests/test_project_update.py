import argparse
import contextlib
from io import StringIO
import os
import tempfile

from logpose import cli
from logpose.db import (
    get_db,
    idea_add,
    project_add,
    project_get,
    task_add,
    task_add_dep,
    task_get_deps,
)


def run_with_db(db_path, fn, args):
    orig_get_db = cli.get_db
    out = StringIO()
    try:
        cli.get_db = lambda: get_db(db_path)
        with contextlib.redirect_stdout(out):
            fn(args)
        return 0, out.getvalue()
    except SystemExit as e:
        return e.code, out.getvalue()
    finally:
        cli.get_db = orig_get_db


def test_project_update_path_preserves_related_rows_and_deps():
    with tempfile.NamedTemporaryFile() as f, tempfile.TemporaryDirectory() as old_dir, tempfile.TemporaryDirectory() as new_dir:
        agents_path = os.path.join(new_dir, "AGENTS.md")
        open(agents_path, "w").close()

        conn = get_db(f.name)
        project = project_add(conn, "demo", old_dir, pr_workflow=True)
        idea = idea_add(conn, project["id"], "idea")
        dep = task_add(conn, project["id"], "dep")
        task = task_add(conn, project["id"], "task", idea_id=idea["id"])
        task_add_dep(conn, task["id"], dep["id"])
        conn.close()

        code, out = run_with_db(
            f.name,
            cli.cmd_project_update,
            argparse.Namespace(name="demo", path=new_dir, pr=False, no_pr=False),
        )

        conn = get_db(f.name)
        updated = project_get(conn, "demo")
        deps = task_get_deps(conn, task["id"])
        conn.close()

        assert code == 0
        assert "Project 'demo' updated." in out
        assert updated["id"] == project["id"]
        assert updated["path"] == new_dir
        assert updated["agents_md_path"] == agents_path
        assert updated["pr_workflow"] == 1
        assert [d["id"] for d in deps] == [dep["id"]]


def test_project_update_path_rejects_invalid_path_without_change():
    with tempfile.NamedTemporaryFile() as f, tempfile.TemporaryDirectory() as old_dir:
        conn = get_db(f.name)
        project_add(conn, "demo", old_dir)
        conn.close()

        code, out = run_with_db(
            f.name,
            cli.cmd_project_update,
            argparse.Namespace(name="demo", path="/definitely/not/here", pr=False, no_pr=False),
        )

        conn = get_db(f.name)
        updated = project_get(conn, "demo")
        conn.close()

        assert code == 1
        assert "Project path does not exist or is not a directory" in out
        assert updated["path"] == old_dir
