"""Tests for per-run --model override flags on model-backed commands."""

import argparse
import contextlib
from io import StringIO
import tempfile
from unittest.mock import patch, MagicMock

from logpose import cli
from logpose import config as config_mod
from logpose import db as db_mod
from logpose.config import get_model_for_complexity, get_model_for_role
from logpose.db import get_db, project_add, task_add, idea_add


# ─── config layer tests ───────────────────────────────────────────────────────

def test_get_model_for_role_override():
    orig_load_config = config_mod.load_config
    try:
        config_mod.load_config = lambda: {"models": {"plan": "openai/gpt-5.5"}}
        assert get_model_for_role("plan") == "openai/gpt-5.5"
        assert get_model_for_role("plan", override="opencode-go/deepseek-v4-flash") == "opencode-go/deepseek-v4-flash"
    finally:
        config_mod.load_config = orig_load_config


def test_get_model_for_role_no_override_falls_back_to_config():
    orig_load_config = config_mod.load_config
    try:
        config_mod.load_config = lambda: {"models": {"plan": "openai/gpt-5.5"}}
        assert get_model_for_role("plan") == "openai/gpt-5.5"
    finally:
        config_mod.load_config = orig_load_config


def test_get_model_for_role_unknown_role_still_raises():
    orig_load_config = config_mod.load_config
    try:
        config_mod.load_config = lambda: {"models": {"refine": "m"}}
        try:
            get_model_for_role("bogus")
            assert False, "expected ValueError"
        except ValueError:
            pass
    finally:
        config_mod.load_config = orig_load_config


def test_get_model_for_complexity_override():
    orig_load_config = config_mod.load_config
    try:
        config_mod.load_config = lambda: {"models": {"3": "openai/glm-5.2"}}
        assert get_model_for_complexity(3) == "openai/glm-5.2"
        assert get_model_for_complexity(3, override="opencode-go/deepseek-v4-flash") == "opencode-go/deepseek-v4-flash"
    finally:
        config_mod.load_config = orig_load_config


def test_get_model_for_complexity_no_override_falls_back_to_config():
    orig_load_config = config_mod.load_config
    try:
        config_mod.load_config = lambda: {"models": {"2": "opencode-go/deepseek-v4-flash"}}
        assert get_model_for_complexity(2) == "opencode-go/deepseek-v4-flash"
    finally:
        config_mod.load_config = orig_load_config


def test_get_model_for_complexity_none_with_override():
    orig_load_config = config_mod.load_config
    try:
        config_mod.load_config = lambda: {"models": {"3": "openai/glm-5.2"}}
        assert get_model_for_complexity(None, override="custom/model") == "custom/model"
    finally:
        config_mod.load_config = orig_load_config


def test_default_config_keeps_provider_catalog_out_of_active_config():
    assert "providers" not in config_mod.DEFAULT_CONFIG


# ─── CLI argparse acceptance tests ────────────────────────────────────────────

def test_argparse_accepts_model_on_plan():
    parser = cli._build_parser()
    args = parser.parse_args(["task", "plan", "1", "--model", "custom/model"])
    assert args.model == "custom/model"


def test_argparse_accepts_model_on_build():
    parser = cli._build_parser()
    args = parser.parse_args(["task", "build", "1", "--model", "other/model", "--force"])
    assert args.model == "other/model"
    assert args.force is True


def test_argparse_accepts_model_on_review():
    parser = cli._build_parser()
    args = parser.parse_args(["task", "review", "1", "--model", "review/model"])
    assert args.model == "review/model"


def test_argparse_accepts_model_on_refine_ai():
    parser = cli._build_parser()
    args = parser.parse_args(["idea", "refine-ai", "1", "--model", "refine/model"])
    assert args.model == "refine/model"


def test_build_without_model_still_defaults():
    parser = cli._build_parser()
    args = parser.parse_args(["task", "build", "1"])
    assert args.model is None
    assert args.force is False


# ─── integration: model appears in output ─────────────────────────────────────

def test_task_plan_prints_model_from_override():
    with tempfile.NamedTemporaryFile() as f:
        conn = get_db(f.name)
        proj = project_add(conn, "demo", "/tmp/demo")
        task_add(conn, proj["id"], "Test task")
        conn.close()
        with patch.object(cli, "get_db", return_value=get_db(f.name)), \
             patch("logpose.opencode.run_plan", return_value=None) as mock_run:
            out = StringIO()
            with contextlib.redirect_stdout(out):
                try:
                    cli.cmd_task_plan(argparse.Namespace(id=1, model="custom/planner"))
                except SystemExit:
                    pass  # run_plan returned None plan -> exits
            assert "Model: custom/planner" in out.getvalue()
            assert mock_run.called
            assert mock_run.call_args[1].get("model") == "custom/planner"


def test_task_build_prints_model_from_override():
    with tempfile.NamedTemporaryFile() as f:
        conn = get_db(f.name)
        proj = project_add(conn, "demo", "/tmp/demo")
        task_add(conn, proj["id"], "Test task", complexity=2)
        conn.close()
        with patch.object(cli, "get_db", return_value=get_db(f.name)), \
             patch("logpose.opencode.run_build", return_value=(0, None)) as mock_run, \
             patch.object(cli, "load_config", return_value={"pr_workflow": {"dirs": [], "auto_pr": True}}), \
             patch.object(cli, "_is_pr_mode", return_value=False), \
             patch.object(cli, "_current_branch", return_value="main"), \
             patch.object(cli, "_git"), \
             patch.object(cli, "task_update", return_value=None):
            out = StringIO()
            with contextlib.redirect_stdout(out):
                cli.cmd_task_build(argparse.Namespace(id=1, force=False, model="custom/builder"))
            assert "Model: custom/builder" in out.getvalue()
            assert mock_run.called
            assert mock_run.call_args[1].get("model") == "custom/builder"


def test_task_review_prints_model_from_override():
    with tempfile.NamedTemporaryFile() as f:
        conn = get_db(f.name)
        proj = project_add(conn, "demo", "/tmp/demo")
        task_add(conn, proj["id"], "Test task")
        conn.close()
        with patch.object(cli, "get_db", return_value=get_db(f.name)), \
             patch("logpose.opencode.run_review", return_value=None) as mock_run:
            out = StringIO()
            with contextlib.redirect_stdout(out):
                try:
                    cli.cmd_task_review(argparse.Namespace(id=1, model="custom/reviewer"))
                except SystemExit:
                    pass
            assert "Model: custom/reviewer" in out.getvalue()
            assert mock_run.called
            assert mock_run.call_args[1].get("model") == "custom/reviewer"


def test_idea_refine_ai_prints_model_from_override():
    with tempfile.NamedTemporaryFile() as f:
        conn = get_db(f.name)
        proj = project_add(conn, "demo", "/tmp/demo")
        idea_add(conn, proj["id"], "Test idea")
        conn.close()
        with patch.object(cli, "get_db", return_value=get_db(f.name)), \
             patch("logpose.opencode.run_refine", return_value=None) as mock_run:
            out = StringIO()
            with contextlib.redirect_stdout(out):
                cli.cmd_idea_refine_ai(argparse.Namespace(id=1, model="custom/refiner"))
            assert "Model: custom/refiner" in out.getvalue()
            assert mock_run.called
            assert mock_run.call_args[1].get("model") == "custom/refiner"


# ─── model override is passed through to opencode functions ───────────────────

def test_task_plan_passes_model_to_run_plan():
    with tempfile.NamedTemporaryFile() as f:
        conn = get_db(f.name)
        proj = project_add(conn, "demo", "/tmp/demo")
        task_add(conn, proj["id"], "Test task")
        conn.close()
        with patch.object(cli, "get_db", return_value=get_db(f.name)), \
             patch("logpose.opencode.run_plan", return_value="/tmp/plan.md") as mock_run:
            with patch.object(cli, "task_update", return_value=None):
                out = StringIO()
                with contextlib.redirect_stdout(out):
                    try:
                        cli.cmd_task_plan(argparse.Namespace(id=1, model="override/model"))
                    except SystemExit:
                        pass
                assert mock_run.called
                assert mock_run.call_args[1].get("model") == "override/model"


def test_task_build_passes_model_to_run_build():
    with tempfile.NamedTemporaryFile() as f:
        conn = get_db(f.name)
        proj = project_add(conn, "demo", "/tmp/demo")
        task_add(conn, proj["id"], "Test task", complexity=2)
        conn.close()
        with patch.object(cli, "get_db", return_value=get_db(f.name)), \
             patch("logpose.opencode.run_build", return_value=(0, None)) as mock_run, \
             patch.object(cli, "load_config", return_value={"pr_workflow": {"dirs": [], "auto_pr": True}}), \
             patch.object(cli, "_is_pr_mode", return_value=False), \
             patch.object(cli, "_current_branch", return_value="main"), \
             patch.object(cli, "_git"), \
             patch.object(cli, "task_update", return_value=None):
            out = StringIO()
            with contextlib.redirect_stdout(out):
                cli.cmd_task_build(argparse.Namespace(id=1, force=False, model="override/builder"))
            assert mock_run.called
            assert mock_run.call_args[1].get("model") == "override/builder"


def test_task_review_passes_model_to_run_review():
    with tempfile.NamedTemporaryFile() as f:
        conn = get_db(f.name)
        proj = project_add(conn, "demo", "/tmp/demo")
        task_add(conn, proj["id"], "Test task")
        conn.close()
        with patch.object(cli, "get_db", return_value=get_db(f.name)), \
             patch("logpose.opencode.run_review", return_value=None) as mock_run:
            out = StringIO()
            with contextlib.redirect_stdout(out):
                try:
                    cli.cmd_task_review(argparse.Namespace(id=1, model="override/reviewer"))
                except SystemExit:
                    pass
            assert mock_run.called
            assert mock_run.call_args[1].get("model") == "override/reviewer"


def test_idea_refine_ai_passes_model_to_run_refine():
    with tempfile.NamedTemporaryFile() as f:
        conn = get_db(f.name)
        proj = project_add(conn, "demo", "/tmp/demo")
        idea_add(conn, proj["id"], "Test idea")
        conn.close()
        with patch.object(cli, "get_db", return_value=get_db(f.name)), \
             patch("logpose.opencode.run_refine", return_value="refined text") as mock_run:
            with patch.object(cli, "idea_update", return_value=None):
                out = StringIO()
                with contextlib.redirect_stdout(out):
                    cli.cmd_idea_refine_ai(argparse.Namespace(id=1, model="override/refiner"))
                assert mock_run.called
                assert mock_run.call_args[1].get("model") == "override/refiner"


if __name__ == "__main__":
    test_get_model_for_role_override()
    test_get_model_for_role_no_override_falls_back_to_config()
    test_get_model_for_role_unknown_role_still_raises()
    test_get_model_for_complexity_override()
    test_get_model_for_complexity_no_override_falls_back_to_config()
    test_get_model_for_complexity_none_with_override()
    test_argparse_accepts_model_on_plan()
    test_argparse_accepts_model_on_build()
    test_argparse_accepts_model_on_review()
    test_argparse_accepts_model_on_refine_ai()
    test_build_without_model_still_defaults()
    test_task_plan_prints_model_from_override()
    test_task_build_prints_model_from_override()
    test_task_review_prints_model_from_override()
    test_idea_refine_ai_prints_model_from_override()
    test_task_plan_passes_model_to_run_plan()
    test_task_build_passes_model_to_run_build()
    test_task_review_passes_model_to_run_review()
    test_idea_refine_ai_passes_model_to_run_refine()
    print("all tests OK")
