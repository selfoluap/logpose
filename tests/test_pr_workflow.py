"""Smoke tests for PR workflow behavior (stdlib only)."""

import argparse
import contextlib
from io import StringIO
import tempfile

from logpose import db as db_mod
from logpose import cli
from logpose.db import get_db, project_add, project_update, task_add


def test_project_pr_workflow_column_migrates_and_updates():
    with tempfile.NamedTemporaryFile() as f:
        conn = get_db(f.name)
        project = project_add(conn, "demo", "/tmp/demo", pr_workflow=True)

        assert project["pr_workflow"] == 1

        updated = project_update(conn, project["id"], pr_workflow=0)
        assert updated["pr_workflow"] == 0

        conn.close()


def test_pr_mode_matches_project_flag_or_config_dir():
    with tempfile.NamedTemporaryFile() as f:
        conn = get_db(f.name)
        flagged = project_add(conn, "flagged", "/tmp/anything", pr_workflow=True)
        matched = project_add(conn, "matched", "/tmp/work/app")
        plain = project_add(conn, "plain", "/opt/app")

        config = {"pr_workflow": {"dirs": ["/tmp/work"], "auto_pr": True}}

        assert cli._is_pr_mode(flagged, config)
        assert cli._is_pr_mode(matched, config)
        assert not cli._is_pr_mode(plain, config)

        conn.close()


def test_task_branch_name_is_capped_and_slugged():
    task = {"id": 12, "title": "Fix Login!!! With A Very Long Title That Keeps Going"}
    branch = cli._task_branch_name(task)

    assert branch.startswith("task-12-fix-login-with-a-very-long")
    assert len(branch) <= 40


def test_cmd_task_build_pr_mode_uses_branch_push_and_pr_create():
    with tempfile.NamedTemporaryFile() as f:
        conn = get_db(f.name)
        project = project_add(conn, "demo", "/tmp/demo", pr_workflow=True)
        task = task_add(conn, project["id"], "Fix login")
        conn.close()

        orig_db_path = db_mod.DEFAULT_DB_PATH
        orig_get_db = cli.get_db
        orig_load_config = cli.load_config
        orig_get_model = cli.get_model_for_complexity
        orig_git = getattr(cli, "_git", None)
        orig_branch = getattr(cli, "_current_branch", None)

        import logpose.opencode as opencode
        orig_run_build = opencode.run_build

        git_calls = []
        subprocess_calls = []

        def fake_git(project_path, *args):
            git_calls.append((project_path, args))

        class FakeSubprocess:
            @staticmethod
            def check_call(cmd, cwd=None):
                subprocess_calls.append((tuple(cmd), cwd))

        def fake_run_build(**kwargs):
            return 0, "/tmp/build.log"

        try:
            db_mod.DEFAULT_DB_PATH = f.name
            cli.get_db = lambda: db_mod.get_db(f.name)
            cli.load_config = lambda: {"pr_workflow": {"dirs": [], "auto_pr": True}}
            cli.get_model_for_complexity = lambda complexity: "test-model"
            cli._git = fake_git
            cli._current_branch = lambda project_path: "main"
            cli.subprocess = FakeSubprocess
            opencode.run_build = fake_run_build

            args = argparse.Namespace(id=task["id"], force=False)
            captured = StringIO()
            with contextlib.redirect_stdout(captured):
                cli.cmd_task_build(args)

            output = captured.getvalue()
            assert "[logpose] PR mode: branch task-1-fix-login" in output
            assert ("/tmp/demo", ("checkout", "-b", "task-1-fix-login")) in git_calls
            assert ("/tmp/demo", ("push", "-u", "origin", "task-1-fix-login")) in git_calls
            assert (("gh", "pr", "create", "--fill"), "/tmp/demo") in subprocess_calls
        finally:
            db_mod.DEFAULT_DB_PATH = orig_db_path
            cli.get_db = orig_get_db
            cli.load_config = orig_load_config
            cli.get_model_for_complexity = orig_get_model
            if orig_git is not None:
                cli._git = orig_git
            if orig_branch is not None:
                cli._current_branch = orig_branch
            opencode.run_build = orig_run_build


def test_cmd_task_build_direct_mode_pushes_current_branch_only():
    with tempfile.NamedTemporaryFile() as f:
        conn = get_db(f.name)
        project = project_add(conn, "demo", "/tmp/demo")
        task = task_add(conn, project["id"], "Fix login")
        conn.close()

        orig_db_path = db_mod.DEFAULT_DB_PATH
        orig_get_db = cli.get_db
        orig_load_config = cli.load_config
        orig_get_model = cli.get_model_for_complexity
        orig_git = getattr(cli, "_git", None)
        orig_branch = getattr(cli, "_current_branch", None)

        import logpose.opencode as opencode
        orig_run_build = opencode.run_build

        git_calls = []
        subprocess_calls = []

        def fake_git(project_path, *args):
            git_calls.append((project_path, args))

        class FakeSubprocess:
            @staticmethod
            def check_call(cmd, cwd=None):
                subprocess_calls.append((tuple(cmd), cwd))

        def fake_run_build(**kwargs):
            return 0, "/tmp/build.log"

        try:
            db_mod.DEFAULT_DB_PATH = f.name
            cli.get_db = lambda: db_mod.get_db(f.name)
            cli.load_config = lambda: {"pr_workflow": {"dirs": [], "auto_pr": True}}
            cli.get_model_for_complexity = lambda complexity: "test-model"
            cli._git = fake_git
            cli._current_branch = lambda project_path: "main"
            cli.subprocess = FakeSubprocess
            opencode.run_build = fake_run_build

            args = argparse.Namespace(id=task["id"], force=False)
            captured = StringIO()
            with contextlib.redirect_stdout(captured):
                cli.cmd_task_build(args)

            output = captured.getvalue()
            assert "[logpose] Direct mode: main" in output
            assert ("/tmp/demo", ("push", "origin", "main")) in git_calls
            assert not [call for call in git_calls if call[1][:2] == ("checkout", "-b")]
            assert not subprocess_calls
        finally:
            db_mod.DEFAULT_DB_PATH = orig_db_path
            cli.get_db = orig_get_db
            cli.load_config = orig_load_config
            cli.get_model_for_complexity = orig_get_model
            if orig_git is not None:
                cli._git = orig_git
            if orig_branch is not None:
                cli._current_branch = orig_branch
            opencode.run_build = orig_run_build


if __name__ == "__main__":
    test_project_pr_workflow_column_migrates_and_updates()
    test_pr_mode_matches_project_flag_or_config_dir()
    test_task_branch_name_is_capped_and_slugged()
    test_cmd_task_build_pr_mode_uses_branch_push_and_pr_create()
    test_cmd_task_build_direct_mode_pushes_current_branch_only()
    print("all tests OK")
