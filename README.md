<p align="center">
  <img src="assets/logpose-badge.png" alt="logpose" width="200">
</p>

<h1 align="center">logpose</h1>

<p align="center">
  A CLI wrapper for tracking ideas and tasks, backed by an LLM coding harness.
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

## Why?

This project — like most nowadays — is just a wrapper around LLMs. But it works okayish for me right now. I am mainly using Hermes to capture my ideas and tasks and just wanted to have a quick wrapper around what I think is a better coding harness. Right now I mostly use opencode, because I like the plan and build separation and that every model can be used and I find it to be a little better than Hermes itself.

Only extra skill I pull in is [ponytail](https://github.com/DietrichGebert/ponytail).

The tool is very simple and probably not super useful for many people, but it does what it needs to do for me.

## Dependencies

- [opencode](https://github.com/anomalyco/opencode) — plan and build agents
- [ponytail](https://github.com/DietrichGebert/ponytail) — additional skill

## License

MIT
