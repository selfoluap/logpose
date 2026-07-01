"""Tests for the `lg ui` command."""

import argparse
import contextlib
from io import StringIO
from pathlib import Path
import tempfile

from logpose import cli


def test_find_ui_dir_prefers_sibling_package_json():
    with tempfile.TemporaryDirectory() as d:
        root = Path(d)
        ui = root / "logpose-ui"
        ui.mkdir()
        (ui / "package.json").write_text("{}", encoding="utf-8")

        orig = cli._logpose_source_dir
        try:
            cli._logpose_source_dir = lambda: root / "logpose"
            assert cli._find_ui_dir() == ui
        finally:
            cli._logpose_source_dir = orig


def test_cmd_ui_build_installs_then_builds():
    with tempfile.TemporaryDirectory() as d:
        ui = Path(d)
        (ui / "package.json").write_text("{}", encoding="utf-8")
        calls = []

        orig_find = cli._find_ui_dir
        orig_npm = cli._npm
        try:
            cli._find_ui_dir = lambda: ui
            cli._npm = lambda ui_dir, *args, env=None: calls.append((ui_dir, args, env))

            out = StringIO()
            with contextlib.redirect_stdout(out):
                cli.cmd_ui(argparse.Namespace(ui_command="build", port=3737))

            assert calls == [
                (ui, ("install",), None),
                (ui, ("run", "build"), None),
            ]
            assert "Built logpose-ui" in out.getvalue()
        finally:
            cli._find_ui_dir = orig_find
            cli._npm = orig_npm


def test_cmd_ui_start_builds_missing_dist_and_passes_port():
    with tempfile.TemporaryDirectory() as d:
        ui = Path(d)
        (ui / "package.json").write_text("{}", encoding="utf-8")
        (ui / "node_modules").mkdir()
        calls = []

        orig_find = cli._find_ui_dir
        orig_npm = cli._npm
        try:
            cli._find_ui_dir = lambda: ui
            cli._npm = lambda ui_dir, *args, env=None: calls.append((args, env and env["PORT"]))

            cli.cmd_ui(argparse.Namespace(ui_command="start", port=4000))

            assert calls[0] == (("run", "build"), None)
            assert calls[1] == (("start",), "4000")
        finally:
            cli._find_ui_dir = orig_find
            cli._npm = orig_npm


if __name__ == "__main__":
    test_find_ui_dir_prefers_sibling_package_json()
    test_cmd_ui_build_installs_then_builds()
    test_cmd_ui_start_builds_missing_dist_and_passes_port()
    print("all tests OK")
