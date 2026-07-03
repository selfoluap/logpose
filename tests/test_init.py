"""Tests for logpose/__init__.py."""


def test_has_jsonl_comment():
    import logpose
    import inspect
    source = inspect.getsource(logpose)
    assert "# Test comment for verifying JSONL task-build logging." in source, (
        "Expected JSONL test comment in logpose/__init__.py"
    )


if __name__ == "__main__":
    test_has_jsonl_comment()
    print("all tests OK")
