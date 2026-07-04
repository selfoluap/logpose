---
name: logpose
description: "CLI ticket system — track projects, ideas, bugs, tasks, and dependency graphs across codebases."
version: 3.3.0
author: Hermes Agent (Paulo)
license: MIT
platforms: [linux, macos]
metadata:
  hermes:
    tags: [tickets, project-management, tasks, ideas, bugs, dependency-graph, sentry]
    related_skills: [opencode, writing-plans, subagent-driven-development]
---

# logpose — CLI Ticket System

> **⚠️ MANDATORY WORKFLOW — This is NOT optional.**
> Every unit of project work — every bug fix, feature, investigation, refactor, chore, or change — MUST begin with a logpose task. No exceptions. If you catch yourself reaching for a file or running a command on a project without a logpose task open, STOP immediately and create one. This is enforced at the agent level: you are not trusted to stay on task without the ticket system.

logpose is a CLI ticket system for tracking projects, ideas, and tasks with dependency graphs. Hermes uses it to manage work across codebases. The user communicates ideas in conversation; Hermes captures, refines, and executes them through logpose.

**Binary:** `lg` (symlinked to `~/.local/bin/lg`, source at `~/logpose/`)
**Repo:** `github.com/selfoluap/logpose` (private)
**Data dir:** `~/.logpose/` (SQLite database, config, build logs)

## The Pipeline: IDEA → REFINE → CONVERT → PLAN → BUILD → REVIEW

Exception: Complexity 0 is a narrow mechanical-change bypass. C0 may be patched directly by Hermes and verified without `lg task build`. Use only for version bumps, dependency/package version changes, changelog-only edits, typo fixes, config value changes, or generated metadata sync. Anything with logic, behavior, tests, architecture, or uncertainty is C1-C5 and must use plan/build.

Each stage uses a different model optimized for that role:

```
IDEA          (hermes captures in conversation)
  ↓
REFINE-AI     (cheap model — structures the idea into a spec)
  ↓
CONVERT       (creates a task with the refined description)
  ↓
PLAN          (best model — reads codebase, designs architecture)
  ↓
BUILD         (cheap model for simple, expensive for complex — follows the plan)
  ↓
REVIEW        (mid-tier model — spec compliance + code quality checklist)
```

**Key insight:** Small models (DeepSeek V4 Flash) are excellent at **following clear plans**. Expensive models (GPT-5.5) should be reserved for **architecting** — understanding codebases, designing approaches, and making complex decisions. A detailed plan from GPT-5.5 enables DeepSeek Flash to implement at 1/100th the cost.

## Model Selection Configuration

```bash
lg config show              # Show all pipeline role and build complexity models
lg config set refine <model> # Set refine stage model (idea → spec)
lg config set plan <model>   # Set plan stage model (spec → implementation plan)
lg config set review <model> # Set review stage model (implementation → quality check)
lg config set 1 <model>      # Set build model for complexity 1 (trivial)
lg config set 2 <model>      # Set build model for complexity 2 (simple)
lg config set 3 <model>      # Set build model for complexity 3 (standard)
lg config set 4 <model>      # Set build model for complexity 4 (complex)
lg config set 5 <model>      # Set build model for complexity 5 (very complex)
lg config reset              # Reset all to defaults
```

Current defaults:
| Role / Level | Model | Purpose |
|---|---|---|
| refine | opencode-go/deepseek-v4-flash | Cheap, good instruction following |
| plan | openai/gpt-5.5 | Best reasoning, reads codebases |
| review | opencode-go/deepseek-v4-pro | Attention to detail, checklist review |
| 0 (mechanical) | no build model | Hermes direct patch + verification only |
| 1 (trivial) | opencode-go/deepseek-v4-flash | Follows plans well |
| 2 (simple) | opencode-go/deepseek-v4-flash | Follows plans well |
| 3 (standard) | openai/glm-5.2 | Standard implementation |
| 4 (complex) | openai/gpt-5.4 | Needs stronger reasoning |
| 5 (very complex) | openai/gpt-5.5 | Frontier for hardest tasks |

## Enforcement Loop (MANDATORY — single authoritative sequence)

This is the ONLY sequence allowed when the user asks you to do something on a project. Every step is required; skipping any step is a violation. **The user can see your tool calls. If you read a project file before the task is `in_progress`, they will call you on it immediately.**

### Step 1 — STOP
Do not touch any project files. Not read_file, not search_files, not terminal, not browser, nothing. The question is not "can I peek at the code first?" — the answer is no.

### Step 2 — CREATE or ACTIVATE
- **No task exists yet** → `lg idea add <project> "<title>" -d "<description>"`. The description is WHAT, not HOW. Capture exactly what the user said, no implementation hints.
- **Task exists in `pending`** → `lg task status <id> in_progress` before any further action.
- **Task exists in `planned`** (after `lg task plan`) → `lg task status <id> in_progress`. **Reading project files for codebase understanding IS implementation work, not prep work.** If you need to read code to understand it before building, the task must already be `in_progress`.

### Step 3 — CONFIRM
Tell the user what task you activated and that you're proceeding. One sentence.

### Step 4 — WORK
Use the method matching complexity:
| Complexity | Method |
|---|---|
| C:0 | Hermes may apply a direct mechanical patch, run verification, then `lg task status <id> done`. No build model. |
| C:1–5 | `lg task build <id>` — opencode runs with `--dangerously-skip-permissions`, reads the plan, implements, runs tests, commits. |
| Any | After build completes, verify output compiles. If opencode produced broken code, fix with `delegate_task` subagents or direct tools, then re-verify. |

**Never proceed past Step 1 until Step 2 is done.** The user can see your tool calls. If you read a project file before `lg task status <id> in_progress` shows up in the trace, they will call you on it.

### Self-check reminder (read this EVERY time before a project tool call)

Before every tool call that touches a project's files (read_file, search_files, terminal commands globbing/cat/ls inside the project, or any inspection), silently verify:

> **Q1: "Is there a logpose task for this work, and is it `in_progress`?"**
> If no to either part, STOP and fix it before the tool call goes out.

> **Q2: "Am I about to write implementation code?"**
> If yes — STOP and call `lg task build <id>` instead, unless this is an explicit C0 mechanical patch. The logpose binary refuses to mark C1-C5 tasks done without a build log. You CANNOT bypass this by ignoring instructions — only `--force` works, and the user can see it.

If the answer is no to either part, STOP and fix it before the tool call goes out.

```bash
lg init                           # Initialize database
lg status                         # Overall stats

lg project add <name> <path>      # Register a codebase
lg project list                   # List all projects
lg project show <name>            # Show project with ideas/tasks
lg project rm <name>              # Remove project and all its ideas/tasks

lg idea add <project> <title> [-d desc] [-c 0-5]   # Capture an idea
lg idea list [project] [-s status]                  # List ideas
lg idea show <id>                                   # Show idea details
lg idea refine <id> [-d desc] [-c 0-5]             # Manually mark as refined
lg idea refine-ai <id>                              # AI refinement (uses refine model)
lg idea convert <id>                                # Convert idea → task
lg idea rm <id>                                     # Remove an idea

lg brain add <title> [-d desc] [-t tag]            # Add a standalone idea (no project needed)
lg brain list [-t tag] [-s status]                  # List brain ideas
lg brain show <id>                                  # Show brain idea details
lg brain tag <id> <tag>                             # Set tag on a brain idea
lg brain status <id> <status>                       # Set status (new/exploring/abandoned/done)
lg brain tags                                       # List all tags with counts
lg brain rm <id>                                    # Remove a brain idea

lg task add <project> <title> [-d desc] [-c 0-5]   # Add a task
lg task list [project] [-s status]                  # List tasks
lg task show <id>                                   # Show task with deps + log path
lg task plan <id>                                   # Run opencode plan agent (uses plan model)
lg task build <id> [--force]                        # Run opencode build agent (uses build model by complexity)
lg task review <id>                                 # Run opencode review agent (uses review model)
lg task watch <id>                                  # Tail the build log
lg task status <id> <status>                        # Update task status
lg task deps <id> [dep_id...]                       # Set dependencies
lg task undep <id> <dep_id>                         # Remove a dependency
lg task rm <id>                                     # Remove a task

lg bug add <project> <title> [-d desc] [--source-url url] [--count n] [--first-seen ts] [--last-seen ts] [--level fatal|error|warning|info]  # Add or upsert a bug
lg bug list [project] [-s new|confirmed|promoted]     # List bugs
lg bug show <id>                                       # Show bug details
lg bug status <id> <new|confirmed|promoted>             # Update bug status
lg bug promote <id> [-c 0-5]                           # Convert bug → task (enters pipeline)
lg bug rm <id>                                         # Remove a bug

lg sentry map <sentry_project> <logpose_project>       # Map Sentry project slug to logpose project

lg config show                     # Show all model mappings (roles + complexity)
lg config set <key> <model>        # Set model for a role (refine/plan/review) or level (1-5)
lg config reset                    # Reset defaults

lg graph [project]                # ASCII dependency graph
lg graph [project] -f dot         # DOT format (for Graphviz)
lg next [project]                 # Ready-to-build tasks
lg blocked [project]              # Blocked tasks (incomplete deps)
```

## Pipeline Stages in Detail

### 1. Capture an Idea

When the user mentions a feature idea, bug, or improvement — immediately capture it with `lg idea add`. Do NOT wait for the user to tell you to use logpose; this is the expected default. Do NOT respond with analysis, code, or discussion until the idea is captured.

```bash
lg idea add <project> "<title>" -d "<description>"
```

The description must be **WHAT, not HOW** — never include implementation hints.

### 2. Refine the Idea

**Option A: AI refinement** (recommended for most ideas)

```bash
lg idea refine-ai <id>
```

Spawns opencode with the refine model (DeepSeek V4 Flash by default — cheap and effective). Reads the project's AGENTS.md for context. Produces a structured specification focusing on what, not how.

**Option B: Manual refinement**

If you've already refined the idea through conversation:

```bash
lg idea refine <id> -d "<polished description with scope and constraints>"
```

Write the refined description in clear, actionable terms describing **what** should be built and why — do NOT include implementation hints or "how to do it."

### 3. Convert to Task

```bash
lg idea convert <id>
```

Creates a task with status "pending". The idea is marked as "converted". The refined description (from step 2) becomes the task description.

### 4. Plan (uses PLAN model — GPT-5.5)

```bash
lg task plan <id>
```

Spawns opencode with the plan model (GPT-5.5 by default — the strongest reasoner). This is the most important stage: a good plan from a strong model enables cheap models to implement well. The plan agent reads AGENTS.md, understands the codebase architecture, and writes a detailed implementation plan.

The plan is saved to `<project>/plans/task-<id>-<slug>.md` and the task status is updated to "planned."

**If opencode plan times out:** kill it and retry once. If it fails a second time, write the plan manually to `<project>/plans/task-<id>-<slug>.md` using the plan template, then `lg task status <id> planned`. Do NOT skip the plan step — and do NOT start implementing after writing the plan manually. The plan is for `lg task build` to follow, not for you to follow.

### 5. Build (uses BUILD model — varies by complexity) — THE ONLY WAY

> **🚨 HARD GATE: Build log required to mark done for C1-C5.**
> `lg task status <id> done` refuses if no build log exists for C1-C5 tasks. C0 is the only explicit exception, and still requires verification after the direct mechanical patch.

> **🚨 STOP: No direct file access for code writing — ever.**
> `write_file`, `patch`, `terminal` (for code edits), and `delegate_task` subagents are FORBIDDEN for writing implementation code. They are only allowed for:
> - Reading/diagnosing (read_file, search_files, terminal ls/cat for exploration)
> - Running tests (npm test, pytest)
> - Verifying builds (npx tsc --noEmit, npx vite build)
> - Configuration/logpose changes (this skill, memory, logpose repo itself)

```bash
lg task build <id>
```

`lg task build` spawns `opencode run --dangerously-skip-permissions` so file operations auto-approve in non-interactive (no-PTY) subprocess contexts. The `--dangerously-skip-permissions` flag only affects the subprocess spawned by `lg task build` — interactive opencode TUI sessions still prompt normally. Builds work end-to-end from Hermes.

After the build completes, verify the output:

```bash
cd <project> && npx tsc --noEmit  # TypeScript check
cd <project> && npx vite build     # Production build
```

Always verify the build compiles cleanly. If the opencode build produces broken code, you MAY fix it with direct tools (`patch`/`write_file`) or `delegate_task` subagents — but ONLY after `lg task build` ran and created a log. Then re-verify.

The build model is selected based on the task's complexity score:
- 0 (mechanical): no build model — direct patch + verification only
- 1-2 (trivial/simple): DeepSeek V4 Flash — cheap, fast, follows plans well
- 3 (standard): GLM-5.2 — standard implementation model
- 4 (complex): GPT-5.4 — needs stronger reasoning
- 5 (very complex): GPT-5.5 — frontier model for hardest tasks

Dependencies are checked — if any aren't done, the build is blocked (use `--force` to override). Task status: in_progress → done (on success) or blocked (on failure).

### 6. Review (uses REVIEW model — DeepSeek V4 Pro)

```bash
lg task review <id>
```

Spawns opencode with the review model (DeepSeek V4 Pro by default). Reviews the implementation against the original spec with a structured checklist:
- Spec compliance (all requirements met?)
- Code quality (error handling, naming, edge cases)
- Project conventions (AGENTS.md)

Review logs are saved to `~/.logpose/logs/review-<id>-<slug>.log`.

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

## Batch Execution

When the user says "plan all", "build all", "review all", or any variant:
- Execute all eligible tasks in dependency order
- Do NOT ask for confirmation between tasks — just run them sequentially
- Report results at the end (which succeeded, which failed)
- If one fails mid-chain, stop and report which one broke — don't continue to dependent tasks

### Full Pipeline Batch

When the user says "run the pipeline" or "process all ideas":
1. Find all `new` ideas → `lg idea refine-ai` each
2. Find all `refined` ideas → `lg idea convert` each
3. Find all `pending` tasks → `lg task plan` each (in dependency order)
4. Find all `planned` tasks → `lg task build` each (in dependency order)
5. Find all `done` tasks → `lg task review` each (optional)

## Dependency Graph

- `lg task deps <id> <dep_id1> <dep_id2>` — sets dependencies (replaces all existing)
- `lg task undep <id> <dep_id>` — removes a single dependency
- Dependencies are checked before build — blocked tasks won't build
- Cycle detection prevents circular dependencies
- **Cross-project dependencies are not allowed.** Both tasks must be in the same project.

## Complexity & Model Selection

Build model is selected based on the task's complexity score (0-5):

| Complexity | Default Model | Use Case |
|---|---|---|
| 0 | no build model | Mechanical changes only; direct patch + verification |
| 1 | DeepSeek V4 Flash | Trivial but non-mechanical changes |
| 2 | DeepSeek V4 Flash | Simple features, small bug fixes |
| 3 | GLM-5.2 | Standard implementation |
| 4 | GPT-5.4 | Complex — needs stronger reasoning |
| 5 | GPT-5.5 | Very complex — architecture changes, multi-system |

Set when adding: `-c 0-5`. Use `-c 0` only for narrow mechanical changes. Complexity is copied from idea to task on convert.

The plan stage always uses GPT-5.5 (the best reasoner) regardless of complexity, because a good plan is what enables cheap models to succeed.

## Brain Ideas — Personal Idea Inbox

`lg brain` stores standalone (project-less) ideas: learning goals, "someday/maybe" items, personal project concepts. Unlike `lg idea` which is scoped to a registered project and feeds into the build pipeline (refine → convert → plan → build → review), brain ideas are a **backlog** — no pipeline, no dependencies, no complexity scoring.

### When to use `lg brain` vs `lg idea`

| Use case | Command |
|---|---|
| Feature/bug for an existing codebase | `lg idea add <project> <title>` |
| Learning goal, side project concept, tech exploration | `lg brain add <title>` |
| Idea that *could* become a real project later | `lg brain add <title>` (convert later) |

### Statuses

| Status | Meaning |
|---|---|
| `new` | Fresh idea, captured but not touched |
| `exploring` | Actively thinking about or researching |
| `done` | Completed, started elsewhere, or absorbed into another idea |
| `abandoned` | Not happening, explicitly discarded |

### Tags for categorization

Tags are a single-text field, one per idea. Use them for loose grouping:

```bash
lg brain add "Custom webserver in Go" -t go
lg brain add "Vivado TCL upgrade" -t fpga
lg brain list -t fpga           # Filter by tag
lg brain tags                   # See all tags with counts
```

Tags are informal — unlike task dependencies there's no structure, just filtering.

### Consolidating overlapping ideas (merge pattern)

When the user notices multiple brain ideas describe the same goal:

1. **Pick the keeper** — choose the idea that best represents the combined scope
2. **Update its description** — edit the DB entry to reflect the merged scope
3. **Mark the rest `done`** — `lg brain status <id> done`

Example from the session:
```
#4 PYNQ Library Platform     →  keeper (description expanded to include hw parser + auto-doc)
#5 Auto-Dokumentation TerosHDL  →  done (absorbed into #4)
#6 Hardware-File Parser         →  done (absorbed into #4)
```

This keeps the list clean and tells you at a glance what's still active without deleting history.

## Bugs — Defects from Integrations (Sentry)

Bugs are a third entity type (alongside ideas and tasks) for tracking defects from humans or external integrations like Sentry. Unlike ideas (which are unrefined features), bugs represent concrete errors with structured metadata.

### Lifecycle

`new` → `confirmed` → `promoted`

A promoted bug creates a task (entering the normal pipeline: plan → build → review) and links back via `bugs.task_id`.

### Fields

| Field | Purpose |
|---|---|
| `title` | Error type + message |
| `description` | Stacktrace, file:line, platform |
| `source_url` | External URL (Sentry issue URL) — UNIQUE, dedup key |
| `count` | Event count from source (Sentry groups repeated errors) |
| `first_seen` / `last_seen` | Timestamps from source |
| `level` | fatal / error / warning / info |
| `status` | new / confirmed / promoted |
| `task_id` | Linked task (set on promote) |

### Upsert / Dedup

`lg bug add` with a `--source-url` that already exists will UPDATE the existing bug (count, last_seen, level) instead of creating a duplicate. Polling scripts can call `lg bug add` repeatedly and dedup is automatic.

### Sentry Integration

Map Sentry projects to Logpose projects:

```bash
lg sentry map <sentry_project_slug> <logpose_project>
```

The mapping is stored in `~/.logpose/config.json` under `sentry.projects`. A Hermes cronjob polls Sentry's REST API for unresolved issues, resolves the mapping, and calls `lg bug add` for each. On re-poll, existing bugs are updated (count/last_seen) via the upsert behavior.

### Manual Usage

```bash
lg bug add tailgraph "TypeError: null ref" -d "app.py:42 on python" \
  --source-url "https://sentry.io/organizations/acme/issues/123/" \
  --count 17 --last-seen "2026-06-19T10:00:00Z" --level error

lg bug list tailgraph
lg bug promote 1 -c 3   # → creates task #N, enters the pipeline
```

## Build Logs & Watch

Build output captured to `~/.logpose/logs/task-<id>-<slug>.log`.
Review output captured to `~/.logpose/logs/review-<id>-<slug>.log`.
- Log path is stored on the task record (shown in `lg task show`)
- `lg task watch <id>` — tails the log in real-time for in_progress tasks, cats it for finished ones

## Pitfalls

- OpenCode must be installed for plan/build/review commands. If missing: `npm i -g opencode-ai@latest`
- **OpenCode plan agent writes to stdout, not files.** `lg task plan` captures stdout and saves it as the plan .md file. This is normal.
- **OpenCode plan agent can time out even on small projects (5+ min).** Kill the process, retry once. If it fails again, write the plan .md manually using the plan template. Then `lg task status <id> planned`. Do NOT start implementing after writing the plan — it's for opencode build, not for you.
- **OpenCode build can time out on larger tasks (10 min).** If `lg task build` hangs, kill it, then retry with `lg task build <id> --force`. If it fails repeatedly, report the failure to the user — do NOT implement the code yourself with direct tools. The answer to a failed build is to fix the task description or re-run, not to bypass opencode entirely.
- **Build-log gate on `lg task status <id> done`** — new in v3.3.0. C1-C5 refuse to mark done without a build log. C0 is the only direct mechanical-change bypass. The `--force` flag is visible to the user — do not use it habitually.
- **`lg task build` uses `--dangerously-skip-permissions`** to auto-approve file access in non-interactive subprocess contexts. This only affects the subprocess spawned by `lg task build` — interactive opencode TUI sessions still prompt normally. Builds work end-to-end from Hermes. If a build produces broken code, fix with direct tools or `delegate_task` subagents, then re-verify.
- **`lg task build` may fail if the repo lacks a configured git author identity.** Pre-configure in the project repo: `git config user.name "Name" && git config user.email "email@example.com"`.
- **Always clean up after `idea convert` when splitting.** The convert creates a combined task — delete it immediately.
- **Descriptions are WHAT, not HOW.** Never include implementation hints, file paths, code snippets, or architectural decisions in idea/task descriptions. If the user casually mentions an implementation, discard it — don't bake it into the description.
- **Register a project BEFORE adding ideas/tasks to it.**
- **When a project doesn't exist yet, scan the filesystem first** with `find ~ -maxdepth 2 -type d -iname "*keyword*"`, then register it.
- **Build logs are at `~/.logpose/logs/`,** not inside project directories.
- **Complexity defaults to 3 (GLM-5.2) when not set.** Set `-c 0` only for mechanical changes, or `-c` explicitly for simple (1-2) or complex (4-5) tasks.
- **If a build fails, the task is marked "blocked".** Fix the issue, then retry with `lg task build <id> --force`.
- **"plan all" / "build all" — execute all in dependency order without asking.** Don't prompt between tasks. Run sequentially, report at the end.
- **The plan model (GPT-5.5) is always used for planning, regardless of task complexity.** This is intentional — a good plan enables cheap build models to succeed. Don't override the plan model unless the user explicitly asks.
- **Review is separate from build.** `lg task review <id>` runs after the build is done. It uses the review model (DeepSeek V4 Pro), not the build model.
- **Forcing a specific build model regardless of complexity:** temporarily set all 5 levels to the desired model, run the build, then restore defaults. Example for GPT-5.5:
  ```bash
  for i in 1 2 3 4 5; do lg config set $i openai/gpt-5.5; done
  lg task build <id>
  # ... build completes ...
  lg config set 1 opencode-go/deepseek-v4-flash
  lg config set 2 opencode-go/deepseek-v4-flash
  lg config set 3 openai/glm-5.2
  lg config set 4 openai/gpt-5.4
  lg config set 5 openai/gpt-5.5
  ```
  Always restore defaults after — otherwise every future trivial build uses an expensive model.
- **delegate_task subagents for complex tasks (C:3-5) may hit max_iterations before completing all plan steps.** A subagent burning 50 API calls can finish all code but run out of tool calls before docs, cleanup, or final verification. Always check the subagent's summary against the plan's step list — if any step is incomplete (typically docs/tests/commit), finish it yourself with direct tools before marking the task done. Do not blindly trust subagent self-reported completion.

## References

- `references/model-selection-research.md` — Model comparison data (costs, benchmarks, role rationale) used to configure pipeline defaults. Verify before updating defaults since prices change.
- `references/sqlite-best-practices.md` — SQLite memory optimization for data pipelines: .backup vs cp, column selection, chunking, setrlimit memory limits, event auto-detection from timestamps. Useful for projects with large databases on memory-constrained hardware (Pi, edge devices).
