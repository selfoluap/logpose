# logpose Agent Guide

logpose is a CLI ticket system — the log pose to your next island. It tracks projects, ideas, tasks, and task dependency graphs. Named after the Log Pose from One Piece, the compass that points to the next island.

## Architecture

```
logpose/
  lg                     # Shell entry point
  logpose/
    __init__.py
    cli.py               # argparse CLI — all commands
    config.py             # Model mapping config (~/.logpose/config.json)
    db.py                 # SQLite schema, CRUD operations
    graph.py              # ASCII and DOT dependency graph rendering
    opencode.py           # OpenCode integration (plan + build)
  ui/                    # React/Vite dashboard frontend
  pyproject.toml
```

Data stored at `~/.logpose/`:
- `tix.db` — SQLite database (legacy name)
- `config.json` — model mapping by complexity
- `logs/` — build log files (centralized, one per task)

## CLI Reference

```
lg init                           Initialize database
lg status                         Show stats across all projects

lg project add <name> <path>      Register a project (auto-detects AGENTS.md)
lg project list                   List all projects
lg project show <name>            Show project with its ideas and tasks
lg project rm <name>              Remove project and all its ideas/tasks

lg idea add <project> <title> [-d desc] [-c 0-5]   Add an idea
lg idea list [project] [-s status] [--all]            List ideas (open only by default; --all shows all)
lg idea show <id>                                    Show idea details
lg idea refine <id> [-d refined_desc] [-c 0-5]      Mark idea as refined
lg idea convert <id>                                  Convert idea → task
lg idea rm <id>                                      Remove an idea

lg brain add <title> [-d desc] [-t tag]             Add a standalone (project-less) idea
lg brain list [-t tag] [-s status] [--all]            List brain ideas (open only by default; --all shows all)
lg brain show <id>                                   Show brain idea details
lg brain tag <id> <tag>                              Set tag on a brain idea
lg brain status <id> <status>                        Set status (new/exploring/abandoned/done)
lg brain tags                                        List all tags with counts
lg brain rm <id>                                     Remove a brain idea

lg task add <project> <title> [-d desc] [-c 0-5]   Add a task
lg task list [project] [-s status] [--all]            List tasks (open only by default; --all shows all)
lg task show <id>                                    Show task with dependencies + log path
lg task plan <id>                                    Run opencode plan agent
lg task build <id> [--force]                          Run opencode build agent
lg task watch <id>                                    Tail the build log in real-time
lg task status <id> <status>                          Update task status
lg task deps <id> [dep_id...]                         Set dependencies
lg task undep <id> <dep_id>                           Remove a dependency
lg task rm <id>                                      Remove a task

lg bug add <project> <title> [-d desc] [--source-url url] [--count n] [--first-seen ts] [--last-seen ts] [--level fatal|error|warning|info]  Add or upsert a bug
lg bug list [project] [-s new|confirmed|promoted] [--all]  List bugs (open only by default; --all shows all)
lg bug show <id>                                      Show bug details
lg bug status <id> <new|confirmed|promoted>            Update bug status
lg bug promote <id> [-c 0-5]                           Convert bug → task
lg bug rm <id>                                         Remove a bug

lg sentry map <sentry_project> <logpose_project>        Map Sentry project slug to logpose project
lg sentry poll                                           Sync unresolved Sentry issues into bugs
lg sentry resolve <bug_id>                               Resolve the bug's Sentry issue
lg sentry unresolve <bug_id>                             Reopen the bug's Sentry issue

lg config show                     Show complexity → model mapping
lg config set <1-5> <model>        Set model for a complexity level
lg config reset                    Reset to default model mapping

lg ui [start] [--port 3737]       Launch the ui/ dashboard
lg ui dev [--port 3737]           Start ui/ dev mode (Vite hot reload)
lg ui build                       Build the ui/ frontend

lg graph [project]                ASCII dependency graph
lg graph [project] -f dot         DOT format (for Graphviz)
lg next [project]                 Show ready-to-build tasks
lg blocked [project]              Show blocked tasks (deps not done)
```

## Key Concepts (same as original hermes-tix)

- **Projects** — codebases with a directory path and optional AGENTS.md
- **Ideas** — unrefined features/bugs/chores. Status: new → refined → converted
- **Brain Ideas** — standalone personal ideas / learning goals / someday-maybe items, not tied to any project
- **Tasks** — planned work items. Status: pending → planned → in_progress → done (or blocked)
- **Bugs** — defects from humans or integrations (e.g. Sentry). Status: `new` → `confirmed` → promoted to task. Store source_url, count, first/last_seen, level for external grouping.
- **Dependencies** — tasks can depend on other tasks. Cycle detection.
- **Plans** — implementation plans generated by opencode /plan, saved as .md files
- **Complexity** — score (0-5) on ideas/tasks that determines workflow/method and build model

## Complexity → Model Mapping

| Complexity | Default Model / Method | Use Case |
|---|---|
| 0 | Hermes direct patch, then verify | Mechanical-only edits: version bumps, dependency/package version changes, changelog-only edits, typo fixes, config value changes, generated metadata sync |
| 1 | DeepSeek V4 Flash | Trivial but non-mechanical changes; must use plan/build |
| 2 | DeepSeek V4 Flash | Simple features, small bug fixes |
| 3 | GLM-5.2 or equivalent | Standard implementation work |
| 4 | GPT-5.4 | Complex implementation |
| 5 | GPT-5.5 | Very complex / hardest tasks |

Default when not set: complexity 3 (GLM-5.2).

C0 is the only direct Hermes patch exception. It is only for narrow mechanical edits and still requires verification before marking done. C1-C5 must go through `lg task plan` and `lg task build`; direct Hermes code editing remains forbidden.

## Hermes Integration Pattern

1. **Capture idea**: User mentions an idea → `lg idea add <project> "<title>" -d "<description>" -c <0-5>`
2. **Refine idea**: `lg idea refine <id> -d "<refined>" -c <0-5>`
3. **Convert to task**: `lg idea convert <id>`
4. **Plan**: `lg task plan <id>` → spawns opencode /plan
5. **Build**: `lg task build <id>` → spawns opencode build
6. **Mark done**: `lg task status <id> done`
