"""Configuration management for logpose — role-based and complexity-based model mapping."""

import json
import os
from copy import deepcopy

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
        "0": "logpose/direct-patch",
        "refine": "aperture/deepseek-v4-flash",
        "plan": "openai-codex/gpt-5.5",
        "review": "aperture/deepseek-v4-pro",
        "1": "aperture/deepseek-v4-flash",
        "2": "aperture/deepseek-v4-flash",
        "3": "aperture/glm-5.2",
        "4": "openai-codex/gpt-5.4",
        "5": "openai-codex/gpt-5.5",
    },
    "sentry": {
        "org": None,
        "projects": {},
    },
    "pr_workflow": {
        "dirs": [],
        "auto_pr": True,
        "min_complexity": 3,
    },
}


def load_config():
    """Load config from file, creating default if not exists.

    Migrates old configs by adding missing role keys with defaults.
    """
    if os.path.isfile(CONFIG_PATH):
        with open(CONFIG_PATH, "r") as f:
            config = json.load(f)
        # Migrate: add missing model keys with defaults
        changed = False
        config.setdefault("models", {})
        for key, model in DEFAULT_CONFIG["models"].items():
            if key not in config["models"]:
                config["models"][key] = model
                changed = True
        if "pr_workflow" not in config:
            config["pr_workflow"] = dict(DEFAULT_CONFIG["pr_workflow"])
            changed = True
        else:
            if "dirs" not in config["pr_workflow"]:
                config["pr_workflow"]["dirs"] = []
                changed = True
            if "auto_pr" not in config["pr_workflow"]:
                config["pr_workflow"]["auto_pr"] = True
                changed = True
            if "min_complexity" not in config["pr_workflow"]:
                config["pr_workflow"]["min_complexity"] = 3
                changed = True
        if "sentry" not in config:
            config["sentry"] = {"org": None, "projects": {}}
            changed = True
        else:
            if "org" not in config["sentry"]:
                config["sentry"]["org"] = None
                changed = True
            if "projects" not in config["sentry"]:
                config["sentry"]["projects"] = {}
                changed = True
        if changed:
            save_config(config)
        return config
    config = deepcopy(DEFAULT_CONFIG)
    os.makedirs(CONFIG_DIR, exist_ok=True)
    save_config(config)
    return config


def save_config(config_dict):
    """Save config dict back to file."""
    os.makedirs(CONFIG_DIR, exist_ok=True)
    with open(CONFIG_PATH, "w") as f:
        json.dump(config_dict, f, indent=2)
        f.write("\n")


def get_model_for_complexity(score, override=None):
    """Return the build model for a given build complexity score (1-5).

    If override is provided, returns override directly (per-run override).
    If score is None, fall back to model for score 3.
    Complexity 0 is not a build complexity and must be blocked by the CLI.
    If score is out of range, clamp to 1-5.
    """
    if override is not None:
        return override
    config = load_config()
    models = config["models"]
    if score is None:
        return models.get("3", DEFAULT_CONFIG["models"]["3"])
    score = max(1, min(5, score))
    return models.get(str(score), DEFAULT_CONFIG["models"].get(str(score), "aperture/deepseek-v4-flash"))


def get_model_for_role(role, override=None):
    """Return the model for a pipeline role: 'refine', 'plan', or 'review'.

    If override is provided, returns override directly (per-run override).
    Falls back to defaults if the role key is missing from config.
    """
    if override is not None:
        return override
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
    save_config(deepcopy(DEFAULT_CONFIG))


# ─── Sentry integration ──────────────────────────────────────────────────────

def set_sentry_project_mapping(sentry_project, logpose_project):
    """Map a Sentry project slug to a logpose project name."""
    config = load_config()
    config.setdefault("sentry", {}).setdefault("projects", {})[sentry_project] = logpose_project
    save_config(config)


def pr_dirs():
    return load_config().get("pr_workflow", {}).get("dirs", [])


def pr_add_dir(path):
    config = load_config()
    dirs = config.setdefault("pr_workflow", {}).setdefault("dirs", [])
    path = os.path.abspath(os.path.expanduser(path))
    if path not in dirs:
        dirs.append(path)
        save_config(config)
    return path


def pr_remove_dir(path):
    config = load_config()
    dirs = config.setdefault("pr_workflow", {}).setdefault("dirs", [])
    path = os.path.abspath(os.path.expanduser(path))
    config["pr_workflow"]["dirs"] = [d for d in dirs if d != path]
    save_config(config)
    return path
