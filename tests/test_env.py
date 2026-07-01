"""Tests for ~/.logpose/.env loading (stdlib only)."""

import os
import tempfile

from logpose.cli import _load_env


def env_path(tmp_home):
    return os.path.join(tmp_home, ".env")


def test_loads_key_value():
    with tempfile.TemporaryDirectory() as tmp:
        p = env_path(tmp)
        with open(p, "w") as f:
            f.write("SENTRY_AUTH_TOKEN=abc123\n")
        _load_env(tmp)
        assert os.environ.get("SENTRY_AUTH_TOKEN") == "abc123"
        del os.environ["SENTRY_AUTH_TOKEN"]


def test_does_not_overwrite_existing():
    os.environ["SENTRY_AUTH_TOKEN"] = "existing"
    with tempfile.TemporaryDirectory() as tmp:
        p = env_path(tmp)
        with open(p, "w") as f:
            f.write("SENTRY_AUTH_TOKEN=abc123\n")
        _load_env(tmp)
        assert os.environ["SENTRY_AUTH_TOKEN"] == "existing"
        del os.environ["SENTRY_AUTH_TOKEN"]


def test_no_file_noop():
    with tempfile.TemporaryDirectory() as tmp:
        _load_env(tmp)
        assert os.environ.get("NEVER_SET") is None


def test_skips_empty_lines_and_comments():
    with tempfile.TemporaryDirectory() as tmp:
        p = env_path(tmp)
        with open(p, "w") as f:
            f.write("\n")
            f.write("# this is a comment\n")
            f.write("  \n")
            f.write("KEY=val\n")
        _load_env(tmp)
        assert os.environ.get("KEY") == "val"
        del os.environ["KEY"]


def test_skips_malformed_lines():
    with tempfile.TemporaryDirectory() as tmp:
        p = env_path(tmp)
        with open(p, "w") as f:
            f.write("NO_EQUALS\n")
            f.write("=justvalue\n")
            f.write("KEY=val\n")
        _load_env(tmp)
        assert os.environ.get("KEY") == "val"
        assert os.environ.get("NO_EQUALS") is None
        del os.environ["KEY"]


def test_handles_equals_in_value():
    with tempfile.TemporaryDirectory() as tmp:
        p = env_path(tmp)
        with open(p, "w") as f:
            f.write("KEY=foo=bar\n")
        _load_env(tmp)
        assert os.environ.get("KEY") == "foo=bar"
        del os.environ["KEY"]


def test_strips_double_quotes():
    with tempfile.TemporaryDirectory() as tmp:
        p = env_path(tmp)
        with open(p, "w") as f:
            f.write('KEY="value with spaces"\n')
        _load_env(tmp)
        assert os.environ["KEY"] == "value with spaces"
        del os.environ["KEY"]


def test_strips_single_quotes():
    with tempfile.TemporaryDirectory() as tmp:
        p = env_path(tmp)
        with open(p, "w") as f:
            f.write("KEY='single quoted'\n")
        _load_env(tmp)
        assert os.environ["KEY"] == "single quoted"
        del os.environ["KEY"]


def test_only_strips_outer_quotes():
    with tempfile.TemporaryDirectory() as tmp:
        p = env_path(tmp)
        with open(p, "w") as f:
            f.write('KEY="nested\\"quote"\n')
        _load_env(tmp)
        assert os.environ["KEY"] == 'nested\\"quote'
        del os.environ["KEY"]


if __name__ == "__main__":
    test_loads_key_value()
    test_does_not_overwrite_existing()
    test_no_file_noop()
    test_skips_empty_lines_and_comments()
    test_skips_malformed_lines()
    test_handles_equals_in_value()
    test_strips_double_quotes()
    test_strips_single_quotes()
    test_only_strips_outer_quotes()
    print("all tests OK")
