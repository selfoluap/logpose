---
name: logpose
description: "CLI ticket system — track projects, ideas, tasks, and dependency graphs across codebases."
version: 2.0.0
author: Hermes Agent (Paulo)
license: MIT
platforms: [linux, macos]
metadata:
  hermes:
    tags: [tickets, project-management, tasks, ideas, dependency-graph]
    related_skills: [opencode, writing-plans, subagent-driven-development]
---

# logpose — CLI Ticket System

> **⚠️ MANDATORY WORKFLOW — This is NOT optional.**
> Every unit of project work — every bug fix, feature, investigation, refactor, chore, or change — MUST begin with a logpose task. No exceptions. If you catch yourself reaching for a file or running a command on a project without a logpose task open, STOP immediately and create one. This is enforced at the agent level: you are not trusted to stay on task without the ticket system.

logpose is a CLI ticket system for tracking projects, ideas, and tasks with dependency graphs. Hermes uses it to manage work across codebases. The user communicates ideas in conversation; Hermes captures, refines, and executes them through logpose.

**Binary:** `lg` (symlinked to `~/.local/bin/lg`, source at `~/logpose/`)
**Repo:** `github.com/selfoluap/logpose` (private)
**Data dir:** `~/.logpose/` (SQLite database, config, build logs)

## Core Workflow

```
IDEA → REFINE → CONVERT → PLAN → BUILD → DONE
```

### Rule 0: Task Before Action

Before executing ANY work on a project (reading code, running tests, making edits, researching), you MUST have a logpose task in status `in_progress` or `planned` for that work. This includes:

- **Bug fixes** — user reports a bug? Create a task before diagnosing.
- **Feature requests** — user asks for something new? Create an idea, then a task.
- **Investigations** — "why is X slow?" — create a task before profiling.
- **Chores** — dependency bumps, CI fixes, config changes — create a task.
- **Refactors** — even "small" cleanups — create a task.

If the user says something directly actionable (e.g., "fix the login button") and you don't have a task for it, you MUST create one (`lg task add <project> "..." -d "..."`) BEFORE doing the work. Do not silently work; do not skip.

**Self-check pattern:** Before every tool call that touches a project, ask yourself: "Is there a logpose task tracking this work?" If no, stop and create one. If the task exists but is in `pending`, mark it `in_progress`.

### 1. Capture an Idea

When the user mentions a feature idea, bug, or improvement — immediately capture it with `lg idea add`. Do NOT wait for the user to tell you to use logpose; this is the expected default. Do NOT respond with analysis, code, or discussion until the idea is captured.

```bash
lg idea add <project> "<title>" -d "<description>"
```

If the user is describing it conversationally, extract the essence into a clear title and description. The description must be **WHAT, not HOW** — never include implementation hints.

### 2. Refine the Idea

After discussing the idea with the user when it's well-understood:

```bash
lg idea refine <id> -d "<polished description with scope and constraints>"
```

Write the refined description in clear, actionable terms describing **what** should be built and why — do NOT include implementation hints or "how to do it." Adding implementation detail biases opencode's planning phase and defeats the purpose of letting the AI explore independently. Stick to desired outcome, scope, and constraints.

### 3. Convert to Task

```bash
lg idea convert <id>
```

This creates a task with status "pending". The idea is marked as "converted".

### 4. Plan

Try opencode first, but if it times out (5+ min), write the plan manually:

```bash
lg task plan <id>           # spawns opencode plan agent
```

If opencode times out, read the project files yourself, write a plan .md to `<project>/plans/task-<id>-<title>.md`, then mark it planned manually.

### 5. Build (OpenCode)

```bash
lg task build <id>
```

Dependencies are checked — if any aren't done, the build is blocked (use `--force` to override). Task status: in_progress → done (on success) or blocked (on failure).

### Enforcement Loop (How to Catch Yourself)

When the user asks you to do something on a project — anything at all — your response MUST follow this sequence:

1. **STOP** — do not start working yet.
2. **CREATE** — run `lg task add` (or `lg idea add` if it's early-stage) to create a ticket. If the user was specific enough, include a clear description. If not, ask one clarifying question and capture the answer.
3. **CONFIRM** — tell the user what task you created and that you're proceeding. This is the only feedback needed before work.
4. **WORK** — now start executing. All further tool calls on this project go under this task.

If at any point you realize you started working without a task, stop mid-stride, create the task, update it to `in_progress`, then continue. Do not finish the work first and "backfill" the task later — that defeats the purpose.

## Commands Reference

```bash
lg init                           # Initialize database
lg status                         # Overall stats

lg project add <name> <path>      # Register a codebase
lg project list                   # List all projects
lg project show <name>            # Show project with ideas/tasks
lg project rm <name>              # Remove project and all its ideas/tasks

lg idea add <project> <title> [-d desc] [-c 1-5]   # Capture an idea
lg idea list [project] [-s status]                  # List ideas
lg idea show <id>                                   # Show idea details
lg idea refine <id> [-d desc] [-c 1-5]             # Mark as refined
lg idea convert <id>                                # Convert idea → task
lg idea rm <id>                                     # Remove an idea

lg task add <project> <title> [-d desc] [-c 1-5]   # Add a task
lg task list [project] [-s status]                  # List tasks
lg task show <id>                                   # Show task with deps + log path
lg task plan <id>                                   # Run opencode plan agent
lg task build <id> [--force]                        # Run opencode build agent
lg task watch <id>                                  # Tail the build log
lg task status <id> <status>                        # Update task status
lg task deps <id> [dep_id...]                       # Set dependencies
lg task undep <id> <dep_id>                         # Remove a dependency
lg task rm <id>                                     # Remove a task

lg config show                     # Complexity → model mapping
lg config set <1-5> <model>        # Set model for a complexity level
lg config reset                    # Reset defaults

lg graph [project]                # ASCII dependency graph
lg graph [project] -f dot         # DOT format (for Graphviz)
lg next [project]                 # Ready-to-build tasks
lg blocked [project]              # Blocked tasks (incomplete deps)
```

## Splitting an Idea into Multiple Tasks

When an idea is too broad and should be several independent or sequential tasks:

0. **Scope the idea first.** Do a quick inventory of the affected code before splitting — read relevant files, count components/classes/screens, identify logical boundaries. This prevents arbitrary splits and ensures each subtask has a coherent scope.

1. Create each subtask with `lg task add` directly (bypass idea conversion):
   ```bash
   lg task add <project> "<subtask 1>" -d "<desc>"
   lg task add <project> "<subtask 2>" -d "<desc>"
   ```
2. Set dependencies if there's an execution order:
   ```bash
   lg task deps <task2_id> <task1_id>
   ```
3. Convert the original idea LAST:
   ```bash
   lg idea convert <id>
   ```
4. **IMPORTANT: Clean up the auto-created combined task.** `idea convert` creates a redundant task from the original broad idea. Delete it immediately:
   ```bash
   lg task rm <new_task_id>
   ```

Verify with `lg graph <project>` — you should see only the subtasks, not the combined one.

## When to Use Each Command

- **Any work item — bug fix, feature, investigation, chore, refactor, dependency bump, config tweak, or ANY project change** → create a task immediately with `lg task add <project> "<title>" -d "<description>" -c <complexity>` BEFORE doing any work. This is MANDATORY, not optional. Every unit of work gets a ticket. No exceptions. If you skip this step, you are violating the workflow.
- **"Always use logpose" enforcement** → this is a reinforced workflow preference. You were explicitly told to always use logpose. If you catch yourself working without a logpose task, stop mid-stride, create the task, update it to `in_progress`, then continue. Do not finish the work first and backfill — that defeats the purpose and will not be tolerated.
- **User mentions any feature idea, bug, or improvement** → immediately `lg idea add`. Automatic — do not wait.
- **User discusses/refines an idea** → capture refinements, then `lg idea refine`
- **User says "let's plan this" or "plan all"** → first `lg idea convert`, then plan all tasks in dependency order (no confirmation prompts — just execute sequentially)
- **User says "build it" or "start working on it" or "build all"** → `lg task build` each ready task in order. Stop if one fails mid-chain.
- **User asks "what's next?"** → `lg next`
- **User asks "what's blocked?"** → `lg blocked`
- **User asks about project status** → `lg status` or `lg graph <project>`
- **User mentions task A must be done before task B** → `lg task deps B A`
- **Task failed** → `lg task status <id> blocked` (build does this automatically)

## Batch Execution

When the user says "plan all", "build all", or any variant:
- Execute all eligible tasks in dependency order
- Do NOT ask for confirmation between tasks — just run them sequentially
- Report results at the end (which succeeded, which failed)
- If one fails mid-chain, stop and report which one broke — don't continue to dependent tasks

## Dependency Graph

- `lg task deps <id> <dep_id1> <dep_id2>` — sets dependencies (replaces all existing)
- `lg task undep <id> <dep_id>` — removes a single dependency
- Dependencies are checked before build — blocked tasks won't build
- Cycle detection prevents circular dependencies
- **Cross-project dependencies are not allowed.** Both tasks must be in the same project.

## Complexity & Model Selection

Default mapping:

| Complexity | Model |
|---|---|
| 1-2 | deepseek/deepseek-v4-flash — fast, cheap |
| 3 (default) | openai/glm-5.1 — balanced |
| 4-5 | openai/gpt-5.5 — powerful |

Set when adding: `-c 1-5`. Complexity is copied from idea to task on convert.
Model mapping stored in `~/.logpose/config.json`. Customize via `lg config set <level> <model>`.

## Build Logs & Watch

Build output captured to `~/.logpose/logs/task-<id>-<slug>.log`.
- Log path is stored on the task record (shown in `lg task show`)
- `lg task watch <id>` — tails the log in real-time for in_progress tasks, cats it for finished ones

## Pitfalls

- OpenCode must be installed for plan/build commands. If missing: `npm i -g opencode-ai@latest`
- **OpenCode plan agent writes to stdout, not files.** `lg task plan` captures stdout and saves it as the plan .md file. It does not use file-write tools. This is normal.
- **OpenCode plan agent can time out even on small projects (5+ min).** If it hangs, abort and write the plan manually: read the project files, understand the architecture, and write the plan .md directly. Then use `lg task status <id> planned`.
- **OpenCode build can time out on larger tasks (10 min).** If `lg task build` hangs and is killed by timeout, the task stays "in_progress" and the working tree may have partial changes. Inspect: run tests, check `git status`. If complete, commit and mark done. If partial, finish remaining work manually. Do NOT re-run `lg task build` without `--force`.
- **`lg task build` may fail if the repo lacks a configured git author identity.** Opencode tries to commit changes and hits `Author identity unknown`. Pre-configure in the project repo: `git config user.name "Name" && git config user.email "email@example.com"`.
- **Always clean up after `idea convert` when splitting.** The convert creates a combined task — delete it immediately.
- **Descriptions are WHAT, not HOW.** Never include implementation hints, file paths, code snippets, or architectural decisions in idea/task descriptions. If the user casually mentions an implementation, discard it — don't bake it into the description.
- **Register a project BEFORE adding ideas/tasks to it.**
- **When a project doesn't exist yet, scan the filesystem first** with `find ~ -maxdepth 2 -type d -iname "*keyword*"`, then register it.
- **Build logs are at `~/.logpose/logs/`,** not inside project directories.
- **Complexity defaults to 3 (glm-5.1) when not set.** Set `-c` explicitly for simple (1-2) or complex (4-5) tasks.
- **If a build fails, the task is marked "blocked".** Fix the issue, then retry with `lg task build <id> --force`.
- **"plan all" / "build all" — execute all in dependency order without asking.** Don't prompt between tasks. Run sequentially, report at the end.

## Migration Note

Replaced `hermes-tix` (project: `~/hermes-tix/`, CLI: `tix`, data: `~/.hermes-tix/`). Migrated to `~/logpose/` with CLI `lg` and data at `~/.logpose/`. The old `tix` symlink to `~/.local/bin/tix` was replaced with `lg`.
