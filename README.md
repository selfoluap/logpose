<p align="center">
  <img src="assets/logpose-badge.png" alt="logpose" width="200">
</p>

<h1 align="center">logpose</h1>

<p align="center">
  <strong>The log pose to your next island.</strong>
</p>

<p align="center">
  A CLI ticket system for tracking projects, ideas, tasks, and dependency graphs.
  Named after the <a href="https://onepiece.fandom.com/wiki/Log_Pose">Log Pose</a>
  from One Piece — the compass that points to the next island.
</p>

<p align="center">
  <code>lg</code> · <code>lg idea add</code> · <code>lg task plan</code> · <code>lg graph</code> · <code>lg next</code>
</p>

---

## Install

```bash
git clone https://github.com/selfoluap/logpose.git
cd logpose
ln -sf "$PWD/lg" ~/.local/bin/lg

# Initialize the database
lg init
```

Requires Python 3.10+ (no external dependencies — pure stdlib).

## Quick Start

```bash
# Register a project
lg project add tailgraph ~/tailgraph

# Capture an idea
lg idea add tailgraph "Add zoom controls" -d "Allow zooming in/out on the node canvas"

# Refine it
lg idea refine 1 -d "Implement zoom controls for the node canvas" -c 2

# Convert to a task
lg idea convert 1

# Plan and build
lg task plan 1
lg task build 1
```

## Usage

### Ideas (capture & refine)

```bash
lg idea add <project> "<title>" -d "<description>" -c <1-5>
lg idea list [project]
lg idea refine <id> -d "<description>" -c <1-5>
lg idea convert <id>        # Convert to a task
```

### Tasks (track & execute)

```bash
lg task add <project> "<title>" -d "<description>" -c <1-5>
lg task list [project]
lg task show <id>           # Full details + log path
lg task plan <id>           # Generate an implementation plan
lg task build <id>          # Execute with opencode
lg task watch <id>          # Tail the build log
lg task status <id> done    # Mark as done
lg task deps <id> <dep_id>  # Set dependencies
```

### Project overview

```bash
lg status                   # Overall stats
lg graph [project]          # ASCII dependency graph
lg next [project]           # Ready-to-build tasks
lg blocked [project]        # Tasks blocked by dependencies
```

## How It Works

- **Ideas** are raw feature requests or bugs. Status: `new` → `refined` → `converted`
- **Tasks** are actionable work items. Status: `pending` → `planned` → `in_progress` → `done` (or `blocked`)
- **Complexity** (1–5) determines which opencode model handles planning and building
- **Dependencies** enforce execution order (with cycle detection)
- **Data** is stored in local SQLite at `~/.logpose/` — no servers, no accounts

### Complexity → Model Mapping

| Complexity | Model |
|---|---|
| 1–2 | `deepseek/deepseek-v4-flash` (fast, cheap) |
| 3 (default) | `openai/glm-5.1` (balanced) |
| 4–5 | `openai/gpt-5.5` (powerful) |

Configurable via `lg config set <level> <model>`.

## Why "logpose"?

In the world of One Piece, the Grand Line is a perilous ocean where normal compasses don't work. Pirates use a **Log Pose** — a special compass that locks onto the magnetic field of the next island, guiding them forward one step at a time.

logpose does the same for your projects: it doesn't show you everything at once, just what's next.

## License

MIT
