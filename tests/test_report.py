"""Tests for task report output and JSONL build logging."""

import argparse
import contextlib
import json
from io import StringIO
import os
import tempfile

from logpose import cli
from logpose.db import get_db, project_add, task_add
from logpose.opencode import run_build


def test_task_report_json_structure_and_human_output():
    with tempfile.TemporaryDirectory() as home, tempfile.NamedTemporaryFile() as dbf:
        old_home = os.environ.get("HOME")
        os.environ["HOME"] = home
        try:
            conn = get_db(dbf.name)
            project = project_add(conn, "demo", home)
            task = task_add(conn, project["id"], "PR workflow: auto-branch tasks")
            conn.close()

            log_dir = os.path.join(home, ".logpose", "logs")
            os.makedirs(log_dir, exist_ok=True)
            with open(os.path.join(log_dir, f"task-{task['id']}-build.jsonl"), "w") as f:
                f.write(json.dumps({"type": "step_start", "timestamp": "2026-01-01T00:00:00Z", "part": {"type": "step-start"}}) + "\n")
                f.write(json.dumps({"type": "text", "part": {"text": "I'll inspect the files.", "time": {"start": "2026-01-01T00:00:01Z", "end": "2026-01-01T00:00:02Z"}}}) + "\n")
                f.write(json.dumps({"type": "tool_use", "part": {"tool": "read", "state": {"status": "completed"}, "time": {"start": "2026-01-01T00:00:02Z", "end": "2026-01-01T00:00:05Z"}}}) + "\n")
                f.write(json.dumps({"type": "tool_use", "part": {"tool": "bash", "state": {"status": "completed"}, "time": {"start": "2026-01-01T00:00:05Z", "end": "2026-01-01T00:00:09Z"}}}) + "\n")
                f.write(json.dumps({"type": "step_finish", "timestamp": "2026-01-01T00:00:10Z", "part": {"type": "step-finish", "tokens": {"total": 30, "input": 10, "output": 5, "reasoning": 2, "cache": {"read": 13, "write": 0}}, "cost": 0.01}}) + "\n")

            old_get_db = cli.get_db
            old_files_touched = getattr(cli, "_files_touched", None)
            cli.get_db = lambda: get_db(dbf.name)
            cli._files_touched = lambda project_path, task_id: [
                {"path": "logpose/db.py", "status": "M", "insertions": 18, "deletions": 4}
            ]
            try:
                out = StringIO()
                with contextlib.redirect_stdout(out):
                    cli.cmd_task_report(argparse.Namespace(id=task["id"], human=False))
                data = json.loads(out.getvalue())

                assert data == {
                    "task_id": task["id"],
                    "title": "PR workflow: auto-branch tasks",
                    "duration_seconds": 10,
                    "steps": 1,
                    "tokens": {
                        "input": 10,
                        "output": 5,
                        "reasoning": 2,
                        "cache_read": 13,
                        "cache_write": 0,
                        "total": 30,
                        "cost": 0.01,
                    },
                    "tools": {
                        "bash": {"count": 1, "total_seconds": 4},
                        "read": {"count": 1, "total_seconds": 3},
                    },
                    "messages": ["I'll inspect the files."],
                    "files_touched": [
                        {"path": "logpose/db.py", "status": "M", "insertions": 18, "deletions": 4}
                    ],
                }

                human = StringIO()
                with contextlib.redirect_stdout(human):
                    cli.cmd_task_report(argparse.Namespace(id=task["id"], human=True))
                rendered = human.getvalue()

                assert f"Task #{task['id']}: PR workflow: auto-branch tasks" in rendered
                assert "Duration: 10s  Steps: 1" in rendered
                assert "read: 1 calls, 3s" in rendered
                assert "M logpose/db.py +18 -4" in rendered
            finally:
                cli.get_db = old_get_db
                if old_files_touched is not None:
                    cli._files_touched = old_files_touched
        finally:
            if old_home is None:
                os.environ.pop("HOME", None)
            else:
                os.environ["HOME"] = old_home


def test_run_build_writes_jsonl_and_human_log():
    class FakeProc:
        def __init__(self):
            self.stdout = iter([
                json.dumps({"type": "text", "part": {"text": "Inspecting repo"}}) + "\n",
                json.dumps({"type": "tool_use", "part": {"tool": "read", "state": {"status": "completed"}}}) + "\n",
            ])
            self.returncode = 0

        def wait(self):
            return 0

    with tempfile.TemporaryDirectory() as home, tempfile.TemporaryDirectory() as project_dir:
        old_home = os.environ.get("HOME")
        old_tokens = os.environ.get("LOGPOSE_HERMES_TOKENS")
        os.environ["HOME"] = home
        os.environ["LOGPOSE_HERMES_TOKENS"] = json.dumps({"input": 7})

        import logpose.opencode as opencode

        old_check = opencode._check_opencode
        old_popen = opencode.subprocess.Popen
        opencode._check_opencode = lambda: "/tmp/opencode"

        popen_calls = []

        def fake_popen(cmd, **kwargs):
            popen_calls.append(cmd)
            return FakeProc()

        opencode.subprocess.Popen = fake_popen
        try:
            out = StringIO()
            with contextlib.redirect_stdout(out):
                code, log_path = run_build(3, "Build task", "desc", project_dir)

            assert code == 0
            assert "--format" in popen_calls[0]
            assert "json" in popen_calls[0]

            jsonl_path = os.path.join(home, ".logpose", "logs", "task-3-build.jsonl")
            with open(jsonl_path) as f:
                lines = [line.rstrip("\n") for line in f]
            assert json.loads(lines[0]) == {"hermes_tokens": {"input": 7}}
            assert json.loads(lines[1])["type"] == "text"
            assert json.loads(lines[2])["type"] == "tool_use"

            with open(log_path) as f:
                text_log = f.read()
            assert "Inspecting repo\n" == text_log.splitlines(keepends=True)[0]
            assert "[tool] read completed" in text_log
        finally:
            opencode._check_opencode = old_check
            opencode.subprocess.Popen = old_popen
            if old_home is None:
                os.environ.pop("HOME", None)
            else:
                os.environ["HOME"] = old_home
            if old_tokens is None:
                os.environ.pop("LOGPOSE_HERMES_TOKENS", None)
            else:
                os.environ["LOGPOSE_HERMES_TOKENS"] = old_tokens


if __name__ == "__main__":
    test_task_report_json_structure_and_human_output()
    test_run_build_writes_jsonl_and_human_log()
    print("all tests OK")
