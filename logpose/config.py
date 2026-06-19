"""Configuration management for logpose — role-based and complexity-based model mapping."""

import json
import os

CONFIG_DIR = os.path.expanduser("~/.logpose")
CONFIG_PATH = os.path.join(CONFIG_DIR, "config.json")

# Role-based pipeline models + complexity-based build models
# The pipeline: IDEA → refine → PLAN → build → REVIEW
# Each role uses the model best suited for that job:
#   - refine: cheap, good instruction following (structuring ideas into specs)
#   - plan: best reasoning (reading codebase, designing architecture)
#   - build (1-5): scales with complexity, cheap models work well WITH good plans
#   - review: strong instruction following (checklist-based spec/quality checks)
DEFAULT_CONFIG = {
    "models": {
        "refine": "opencode-go/deepseek-v4-flash",
        "plan": "openai/gpt-5.5",
        "review": "opencode-go/deepseek-v4-pro",
        "1": "opencode-go/deepseek-v4-flash",
        "2": "opencode-go/deepseek-v4-flash",
        "3": "opencode-go/deepseek-v4-flash",
        "4": "openai/gpt-5.4",
        "5": "openai/gpt-5.5",
    },
    "sentry": {
        "projects": {}
    },
}


def load_config():
    """Load config from file, creating default if not exists.

    Migrates old configs by adding missing role keys with defaults.
    """
    if os.path.isfile(CONFIG_PATH):
        with open(CONFIG_PATH, "r") as f:
            config = json.load(f)
        # Migrate: add missing role keys with defaults
        changed = False
        for role in ("refine", "plan", "review"):
            if role not in config.get("models", {}):
                config["models"][role] = DEFAULT_CONFIG["models"][role]
                changed = True
        if changed:
            save_config(config)
        return config
    config = dict(DEFAULT_CONFIG)
    os.makedirs(CONFIG_DIR, exist_ok=True)
    save_config(config)
    return config


def save_config(config_dict):
    """Save config dict back to file."""
    os.makedirs(CONFIG_DIR, exist_ok=True)
    with open(CONFIG_PATH, "w") as f:
        json.dump(config_dict, f, indent=2)
        f.write("\n")


def get_model_for_complexity(score):
    """Return the build model for a given complexity score (1-5).

    If score is None, fall back to model for score 3.
    If score is out of range, clamp to 1-5.
    """
    config = load_config()
    models = config["models"]
    if score is None:
        return models.get("3", DEFAULT_CONFIG["models"]["3"])
    score = max(1, min(5, score))
    return models.get(str(score), DEFAULT_CONFIG["models"].get(str(score), "opencode-go/deepseek-v4-flash"))


def get_model_for_role(role):
    """Return the model for a pipeline role: 'refine', 'plan', or 'review'.

    Falls back to defaults if the role key is missing from config.
    """
    config = load_config()
    models = config.get("models", {})
    if role in models:
        return models[role]
    # Fall back to default
    if role in DEFAULT_CONFIG["models"]:
        return DEFAULT_CONFIG["models"][role]
    raise ValueError(f"Unknown role '{role}'. Valid roles: refine, plan, review")


def reset_config():
    """Reset config to defaults."""
    save_config(dict(DEFAULT_CONFIG))


# ─── Sentry integration ──────────────────────────────────────────────────────

def get_sentry_project_mapping(sentry_project):
    """Get the logpose project name mapped to a Sentry project slug."""
    config = load_config()
    return config.get("sentry", {}).get("projects", {}).get(sentry_project)


def set_sentry_project_mapping(sentry_project, logpose_project):
    """Map a Sentry project slug to a logpose project name."""
    config = load_config()
    config.setdefault("sentry", {}).setdefault("projects", {})[sentry_project] = logpose_project
    save_config(config)


def remove_sentry_project_mapping(sentry_project):
    """Remove a Sentry → logpose project mapping."""
    config = load_config()
    config.setdefault("sentry", {}).setdefault("projects", {}).pop(sentry_project, None)
    save_config(config)