"""Configuration management for logpose — model mapping by complexity."""

import json
import os

CONFIG_DIR = os.path.expanduser("~/.logpose")
CONFIG_PATH = os.path.join(CONFIG_DIR, "config.json")

DEFAULT_CONFIG = {
    "models": {
        "1": "deepseek/deepseek-v4-flash",
        "2": "deepseek/deepseek-v4-flash",
        "3": "openai/glm-5.1",
        "4": "openai/gpt-5.5",
        "5": "openai/gpt-5.5",
    }
}


def load_config():
    """Load config from file, creating default if not exists."""
    if os.path.isfile(CONFIG_PATH):
        with open(CONFIG_PATH, "r") as f:
            return json.load(f)
    config = dict(DEFAULT_CONFIG)
    # Ensure the directory exists
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
    """Return the model string for a given complexity score (1-5).

    If score is None, fall back to model for score 3.
    If score is out of range, clamp to 1-5.
    """
    config = load_config()
    models = config["models"]
    if score is None:
        return models["3"]
    # Clamp to 1-5
    score = max(1, min(5, score))
    return models[str(score)]