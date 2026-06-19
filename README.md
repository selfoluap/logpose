<p align="center">
  <img src="assets/logpose-badge.png" alt="logpose" width="200">
</p>

<h1 align="center">logpose</h1>

<p align="center">
  A CLI wrapper for tracking ideas and tasks, backed by an LLM coding harness.
</p>

<p align="center">
  <code>lg</code> · <code>lg idea refine-ai</code> · <code>lg task plan</code> · <code>lg task review</code> · <code>lg graph</code>
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

# AI-refine it (uses cheap model to structure the spec)
lg idea refine-ai 1

# Convert to a task
lg idea convert 1

# Plan (uses strong model to design architecture)
lg task plan 1

# Build (model selected by complexity)
lg task build 1

# Review (uses mid-tier model for quality check)
lg task review 1
```

## The Pipeline

```
IDEA → REFINE-AI → CONVERT → PLAN → BUILD → REVIEW
        (cheap)              (best)    (varies)  (mid-tier)
```

**Key insight:** Small models are excellent at following clear plans. Expensive models should be reserved for architecture and design — a great plan from GPT-5.5 enables DeepSeek V4 Flash to implement at 1/100th the cost.

| Stage | Default Model | Purpose |
|---|---|---|
| **refine-ai** | DeepSeek V4 Flash | Cheap, structures ideas into specs |
| **plan** | GPT-5.5 | Best reasoning, reads codebases |
| **build (C1-3)** | DeepSeek V4 Flash | Follows plans well |
| **build (C4)** | GPT-5.4 | Complex tasks need stronger reasoning |
| **build (C5)** | GPT-5.5 | Frontier for the hardest tasks |
| **review** | DeepSeek V4 Pro | Mid-tier checklist compliance |

## Usage

### Ideas (capture & refine)

```bash
lg idea add <project> "<title>" -d "<description>" -c <1-5>
lg idea list [project]
lg idea show <id>
lg idea refine <id> -d "<description>" -c <1-5>   # Manual refinement
lg idea refine-ai <id>                              # AI refinement (uses refine model)
lg idea convert <id>                                # Convert to a task
lg idea rm <id>
```

### Tasks (track & execute)

```bash
lg task add <project> "<title>" -d "<description>" -c <1-5>
lg task list [project]
lg task show <id>              # Full details + dependencies
lg task plan <id>              # Generate plan (uses plan model)
lg task build <id> [--force]   # Execute with opencode (model by complexity)
lg task review <id>            # Post-build review (uses review model)
lg task watch <id>             # Tail the build log
lg task status <id> <status>   # Update status
lg task deps <id> [dep_id...] # Set dependencies
lg task undep <id> <dep_id>   # Remove a dependency
lg task rm <id>
```

### Bugs (defects & integrations)

```bash
lg bug add <project> "<title>" -d "<description>" \
  --source-url <url> --count <n> --first-seen <ts> --last-seen <ts> --level <fatal|error|warning|info>
lg bug list [project] [-s new|confirmed|promoted]
lg bug show <id>
lg bug status <id> <new|confirmed|promoted>
lg bug promote <id> -c <1-5>   # Convert bug → task (enters the pipeline)
lg bug rm <id>
```

Bugs are created automatically by integrations (Sentry) or manually. Upsert by
`--source-url` — re-adding the same URL updates count/last_seen instead of duplicating.

### Sentry integration

```bash
lg sentry map <sentry_project_slug> <logpose_project>
```

Maps a Sentry project to a Logpose project so a polling cronjob knows where to
file incoming issues as bugs.

### Model configuration

```bash
lg config show                        # Show all pipeline role + complexity mappings
lg config set refine <model>           # Set refine stage model
lg config set plan <model>             # Set plan stage model
lg config set review <model>           # Set review stage model
lg config set <1-5> <model>           # Set build model for a complexity level
lg config reset                        # Reset to defaults
```

### Project overview

```bash
lg status                   # Overall stats
lg graph [project]          # ASCII dependency graph
lg graph [project] -f dot   # DOT format (Graphviz)
lg next [project]           # Ready-to-build tasks
lg blocked [project]        # Tasks blocked by dependencies
```

## How It Works

- **Ideas** are raw feature requests or bugs. Status: `new` → `refined` → `converted`
- **Tasks** are actionable work items. Status: `pending` → `planned` → `in_progress` → `done` (or `blocked`)
- **Bugs** are defects from humans or integrations (e.g. Sentry). Status: `new` → `confirmed` → promoted to task
- **Pipeline roles** (refine, plan, review) each use a dedicated model optimized for that stage
- **Complexity** (1–5) determines which build model handles implementation
- **Dependencies** enforce execution order (with cycle detection)
- **Data** is stored in local SQLite at `~/.logpose/` — no servers, no accounts
- **Build logs** are captured at `~/.logpose/logs/` and linked from the task record

### Role-based Model Mapping

The pipeline has three dedicated roles, each using the best model for the job:

| Role | Default Model | Why |
|---|---|---|
| refine | `opencode-go/deepseek-v4-flash` | Cheap, good instruction following — turns ideas into specs |
| plan | `openai/gpt-5.5` | Best reasoning — reads codebases, designs architecture |
| review | `opencode-go/deepseek-v4-pro` | Attention to detail — structured checklist review |

### Complexity → Build Model Mapping

| Complexity | Default Model | Use Case |
|---|---|---|
| 1 (trivial) | `opencode-go/deepseek-v4-flash` | Config tweaks, one-liners |
| 2 (simple) | `opencode-go/deepseek-v4-flash` | Small features, bug fixes |
| 3 (standard) | `opencode-go/deepseek-v4-flash` | With a good plan, cheap suffices |
| 4 (complex) | `openai/gpt-5.4` | Needs stronger reasoning |
| 5 (very complex) | `openai/gpt-5.5` | Architecture changes, multi-system |

## Why?

This project — like most nowadays — is just a wrapper around LLMs. But it works okayish for me right now. I am mainly using Hermes to capture my ideas and tasks and just wanted to have a quick wrapper around what I think is a better coding harness. Right now I mostly use opencode, because I like the plan and build separation and that every model can be used and I find it to be a little better than Hermes itself.

Only extra skill I pull in is [ponytail](https://github.com/DietrichGebert/ponytail).

The tool is very simple and probably not super useful for many people, but it does what it needs to do for me.

## Dependencies

- [opencode](https://github.com/anomalyco/opencode) — plan, build, and review agents
- [ponytail](https://github.com/DietrichGebert/ponytail) — additional skill

## License

MIT