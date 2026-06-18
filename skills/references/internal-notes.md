# logpose Internal Notes

Developer-facing details for maintaining and extending logpose.

## sqlite3.Row Quirks

`task_list()` and similar functions return `sqlite3.Row` objects (dict-like). They support bracket access (`row["status"]`) and iteration over keys, but NOT attribute access (`row.status`). When building new query functions, ensure callers use `row["key"]` syntax.

## OpenCode Plan Agent stdout Behavior

`lg task plan` spawns opencode with a `/plan` prompt. The plan agent:
- Explores the codebase (reads files, runs commands)
- Outputs the plan as plain text to stdout
- Does NOT write files itself

`lg task plan` captures stdout and saves it as the plan .md file in `<project>/plans/task-<id>-<title>.md`.

## Idea-Convert Cleanup Pattern

When splitting an idea into subtasks, `idea convert` creates a redundant combined task from the original broad idea. The cleanup pattern is:

1. Create subtasks first with `lg task add`
2. Set dependencies with `lg task deps`
3. Convert the idea LAST with `lg idea convert`
4. Delete the auto-created combined task immediately with `lg task rm <new_task_id>`

The combined task is always the one with the highest task ID at conversion time (newest task).

## Data Directory Migration

- Old: `~/.hermes-tix/` (tix.db, config.json, logs/)
- New: `~/.logpose/` (same structure)
- Migration was a simple `mv` — no schema changes
