"""Complexity 0 bypass semantics."""

import argparse
import contextlib
from io import StringIO
from pathlib import Path
import sys
import tempfile

from logpose import cli
from logpose import db as db_mod
from logpose import config as config_mod
from logpose.config import get_model_for_complexity
from logpose.db import get_db, project_add, task_add


ROOT = Path(__file__).resolve().parents[1]


def test_agents_complexity_table_columns_match():
    lines = (ROOT / "AGENTS.md").read_text().splitlines()
    header_index = lines.index("| Complexity | Default Model / Method | Use Case |")

    assert lines[header_index + 1] == "|---|---|---|"


def test_skill_current_defaults_lists_c0_direct_patch_rule():
    text = (ROOT / "skills" / "SKILL.md").read_text()

    assert "| 0 (mechanical) | no build model | Hermes direct patch + verification only |" in text


def test_argparse_accepts_c0_for_add_refine_and_promote():
    calls = []
    originals = {
        "cmd_idea_add": cli.cmd_idea_add,
        "cmd_idea_refine": cli.cmd_idea_refine,
        "cmd_bug_promote": cli.cmd_bug_promote,
        "cmd_task_add": cli.cmd_task_add,
    }
    orig_argv = sys.argv
    try:
        cli.cmd_idea_add = lambda args: calls.append(("idea_add", args.complexity))
        cli.cmd_idea_refine = lambda args: calls.append(("idea_refine", args.complexity))
        cli.cmd_bug_promote = lambda args: calls.append(("bug_promote", args.complexity))
        cli.cmd_task_add = lambda args: calls.append(("task_add", args.complexity))

        for argv in (
            ["lg", "idea", "add", "demo", "Typo", "-c", "0"],
            ["lg", "idea", "refine", "1", "-c", "0"],
            ["lg", "bug", "promote", "1", "-c", "0"],
            ["lg", "task", "add", "demo", "Typo", "-c", "0"],
        ):
            sys.argv = argv
            cli.main()

        assert calls == [
            ("idea_add", 0),
            ("idea_refine", 0),
            ("bug_promote", 0),
            ("task_add", 0),
        ]
    finally:
        for name, fn in originals.items():
            setattr(cli, name, fn)
        sys.argv = orig_argv


def test_c0_task_add_list_and_show_display_complexity_zero():
    with tempfile.NamedTemporaryFile() as f:
        conn = get_db(f.name)
        project_add(conn, "demo", "/tmp/demo")
        conn.close()

        orig_get_db = cli.get_db
        try:
            cli.get_db = lambda: db_mod.get_db(f.name)
            out = StringIO()
            with contextlib.redirect_stdout(out):
                cli.cmd_task_add(argparse.Namespace(project="demo", title="Typo fix", description="", complexity=0))
            assert "(complexity: 0)" in out.getvalue()

            out = StringIO()
            with contextlib.redirect_stdout(out):
                cli.cmd_task_list(argparse.Namespace(project=None, status=None, all=False))
            assert "C:0" in out.getvalue()

            out = StringIO()
            with contextlib.redirect_stdout(out):
                cli.cmd_task_show(argparse.Namespace(id=1))
            assert "complexity: 0" in out.getvalue()
        finally:
            cli.get_db = orig_get_db


def test_c0_can_be_marked_done_without_build_log():
    with tempfile.NamedTemporaryFile() as f:
        conn = get_db(f.name)
        project = project_add(conn, "demo", "/tmp/demo")
        task = task_add(conn, project["id"], "Bump version", complexity=0)
        conn.close()

        orig_get_db = cli.get_db
        try:
            cli.get_db = lambda: db_mod.get_db(f.name)
            out = StringIO()
            with contextlib.redirect_stdout(out):
                cli.cmd_task_status(argparse.Namespace(id=task["id"], status="done", force=False))

            assert "C0 mechanical-change bypass" in out.getvalue()

            conn = get_db(f.name)
            updated = conn.execute("SELECT status FROM tasks WHERE id = ?", (task["id"],)).fetchone()
            conn.close()
            assert updated["status"] == "done"
        finally:
            cli.get_db = orig_get_db


def test_c1_still_requires_build_log_to_mark_done():
    with tempfile.NamedTemporaryFile() as f:
        conn = get_db(f.name)
        project = project_add(conn, "demo", "/tmp/demo")
        task = task_add(conn, project["id"], "Small fix", complexity=1)
        conn.close()

        orig_get_db = cli.get_db
        try:
            cli.get_db = lambda: db_mod.get_db(f.name)
            out = StringIO()
            try:
                with contextlib.redirect_stdout(out):
                    cli.cmd_task_status(argparse.Namespace(id=task["id"], status="done", force=False))
            except SystemExit as e:
                assert e.code == 1
            else:
                raise AssertionError("expected SystemExit")

            assert "has no build log" in out.getvalue()
        finally:
            cli.get_db = orig_get_db


def test_c0_build_is_refused():
    with tempfile.NamedTemporaryFile() as f:
        conn = get_db(f.name)
        project = project_add(conn, "demo", "/tmp/demo")
        task = task_add(conn, project["id"], "Typo fix", complexity=0)
        conn.close()

        orig_get_db = cli.get_db
        try:
            cli.get_db = lambda: db_mod.get_db(f.name)
            out = StringIO()
            try:
                with contextlib.redirect_stdout(out):
                    cli.cmd_task_build(argparse.Namespace(id=task["id"], force=False))
            except SystemExit as e:
                assert e.code == 1
            else:
                raise AssertionError("expected SystemExit")

            assert "complexity 0" in out.getvalue().lower()
        finally:
            cli.get_db = orig_get_db


def test_pr_mode_does_not_treat_c0_as_default_three():
    project = {"id": 1, "name": "demo", "path": "/tmp/demo", "pr_workflow": 0}
    config = {"pr_workflow": {"dirs": [], "auto_pr": True, "min_complexity": 3}}

    assert not cli._is_pr_mode(project, config, 0)
    assert cli._is_pr_mode(project, config, None)


def test_c3_default_model_moves_to_glm_52():
    orig_load_config = config_mod.load_config
    try:
        config_mod.load_config = lambda: {"models": dict(config_mod.DEFAULT_CONFIG["models"])}
        assert get_model_for_complexity(None) == "openai/glm-5.2"
        assert get_model_for_complexity(3) == "openai/glm-5.2"
    finally:
        config_mod.load_config = orig_load_config


def test_config_show_mentions_c0_bypass_and_c3_model():
    orig_load_config = cli.load_config
    try:
        cli.load_config = lambda: {
            "models": {
                "refine": "opencode-go/deepseek-v4-flash",
                "plan": "openai/gpt-5.5",
                "review": "opencode-go/deepseek-v4-pro",
                "1": "opencode-go/deepseek-v4-flash",
                "2": "opencode-go/deepseek-v4-flash",
                "3": "openai/glm-5.2",
                "4": "openai/gpt-5.4",
                "5": "openai/gpt-5.5",
            },
            "pr_workflow": {"dirs": [], "auto_pr": True, "min_complexity": 3},
        }
        out = StringIO()
        with contextlib.redirect_stdout(out):
            cli.cmd_config_show(argparse.Namespace())

        text = out.getvalue()
        assert "0: Hermes direct mechanical patch only (no build model)" in text
        assert "3: openai/glm-5.2" in text
    finally:
        cli.load_config = orig_load_config


if __name__ == "__main__":
    test_c0_can_be_marked_done_without_build_log()
    test_c1_still_requires_build_log_to_mark_done()
    test_c0_build_is_refused()
    test_pr_mode_does_not_treat_c0_as_default_three()
    test_c3_default_model_moves_to_glm_52()
    test_config_show_mentions_c0_bypass_and_c3_model()
    print("all tests OK")
