"""SQLite database layer for hermes-tix ticket system."""

import sqlite3
import os
import time
from pathlib import Path

DEFAULT_DB_DIR = os.path.expanduser("~/.hermes-tix")
DEFAULT_DB_PATH = os.path.join(DEFAULT_DB_DIR, "tix.db")

SCHEMA = """
CREATE TABLE IF NOT EXISTS projects (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    name        TEXT NOT NULL UNIQUE,
    path        TEXT NOT NULL,
    agents_md_path TEXT,
    created_at  REAL NOT NULL,
    updated_at  REAL NOT NULL
);

CREATE TABLE IF NOT EXISTS ideas (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    project_id  INTEGER NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    title       TEXT NOT NULL,
    description TEXT,
    refined_description TEXT,
    status      TEXT NOT NULL DEFAULT 'new',
    created_at  REAL NOT NULL,
    updated_at  REAL NOT NULL
);

CREATE TABLE IF NOT EXISTS tasks (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    project_id  INTEGER NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    idea_id     INTEGER REFERENCES ideas(id) ON DELETE SET NULL,
    title       TEXT NOT NULL,
    description TEXT,
    plan_md_path TEXT,
    log_path    TEXT,
    status      TEXT NOT NULL DEFAULT 'pending',
    created_at  REAL NOT NULL,
    updated_at  REAL NOT NULL
);

CREATE TABLE IF NOT EXISTS task_deps (
    task_id       INTEGER NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
    depends_on_id INTEGER NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
    PRIMARY KEY (task_id, depends_on_id)
);

CREATE INDEX IF NOT EXISTS idx_ideas_project ON ideas(project_id);
CREATE INDEX IF NOT EXISTS idx_ideas_status ON ideas(status);
CREATE INDEX IF NOT EXISTS idx_tasks_project ON tasks(project_id);
CREATE INDEX IF NOT EXISTS idx_tasks_status ON tasks(status);
CREATE INDEX IF NOT EXISTS idx_task_deps_depends ON task_deps(depends_on_id);
"""

# Migration: add log_path column if it doesn't exist (idempotent)
_MIGRATIONS = [
    "ALTER TABLE tasks ADD COLUMN log_path TEXT",
]


def get_db(db_path=None):
    """Get a database connection, creating the DB and tables if needed."""
    path = db_path or DEFAULT_DB_PATH
    os.makedirs(os.path.dirname(path), exist_ok=True)
    conn = sqlite3.connect(path)
    conn.execute("PRAGMA foreign_keys = ON")
    conn.row_factory = sqlite3.Row
    conn.executescript(SCHEMA)
    # Run idempotent migrations
    for migration in _MIGRATIONS:
        try:
            conn.execute(migration)
        except sqlite3.OperationalError:
            pass  # column already exists
    conn.commit()
    return conn


def now():
    return time.time()


# ─── Projects ────────────────────────────────────────────────────────────────

def project_add(conn, name, path, agents_md_path=None):
    """Add a new project. Returns the project row."""
    ts = now()
    conn.execute(
        "INSERT INTO projects (name, path, agents_md_path, created_at, updated_at) VALUES (?, ?, ?, ?, ?)",
        (name, path, agents_md_path, ts, ts),
    )
    conn.commit()
    return project_get(conn, name)


def project_get(conn, name_or_id):
    """Get a project by name or id."""
    if isinstance(name_or_id, int) or (isinstance(name_or_id, str) and name_or_id.isdigit()):
        return conn.execute("SELECT * FROM projects WHERE id = ?", (int(name_or_id),)).fetchone()
    return conn.execute("SELECT * FROM projects WHERE name = ?", (name_or_id,)).fetchone()


def project_list(conn):
    """List all projects."""
    return conn.execute("SELECT * FROM projects ORDER BY name").fetchall()


def project_delete(conn, name_or_id):
    """Delete a project and all its ideas/tasks."""
    proj = project_get(conn, name_or_id)
    if not proj:
        return None
    conn.execute("DELETE FROM projects WHERE id = ?", (proj["id"],))
    conn.commit()
    return proj


# ─── Ideas ───────────────────────────────────────────────────────────────────

def idea_add(conn, project_id, title, description=None):
    """Add a new idea. Returns the idea row."""
    ts = now()
    conn.execute(
        "INSERT INTO ideas (project_id, title, description, status, created_at, updated_at) VALUES (?, ?, ?, 'new', ?, ?)",
        (project_id, title, description, ts, ts),
    )
    conn.commit()
    return conn.execute("SELECT * FROM ideas WHERE id = last_insert_rowid()").fetchone()


def idea_get(conn, idea_id):
    """Get an idea by id."""
    return conn.execute("SELECT * FROM ideas WHERE id = ?", (idea_id,)).fetchone()


def idea_list(conn, project_id=None, status=None):
    """List ideas, optionally filtered by project and/or status."""
    query = "SELECT i.*, p.name as project_name FROM ideas i JOIN projects p ON i.project_id = p.id WHERE 1=1"
    params = []
    if project_id is not None:
        query += " AND i.project_id = ?"
        params.append(project_id)
    if status:
        query += " AND i.status = ?"
        params.append(status)
    query += " ORDER BY i.created_at DESC"
    return conn.execute(query, params).fetchall()


def idea_update(conn, idea_id, **kwargs):
    """Update idea fields."""
    allowed = {"title", "description", "refined_description", "status"}
    updates = {k: v for k, v in kwargs.items() if k in allowed}
    if not updates:
        return idea_get(conn, idea_id)
    updates["updated_at"] = now()
    set_clause = ", ".join(f"{k} = ?" for k in updates)
    values = list(updates.values()) + [idea_id]
    conn.execute(f"UPDATE ideas SET {set_clause} WHERE id = ?", values)
    conn.commit()
    return idea_get(conn, idea_id)


def idea_delete(conn, idea_id):
    """Delete an idea."""
    idea = idea_get(conn, idea_id)
    if idea:
        conn.execute("DELETE FROM ideas WHERE id = ?", (idea_id,))
        conn.commit()
    return idea


# ─── Tasks ───────────────────────────────────────────────────────────────────

def task_add(conn, project_id, title, description=None, idea_id=None):
    """Add a new task. Returns the task row."""
    ts = now()
    conn.execute(
        "INSERT INTO tasks (project_id, idea_id, title, description, status, created_at, updated_at) VALUES (?, ?, ?, ?, 'pending', ?, ?)",
        (project_id, idea_id, title, description, ts, ts),
    )
    conn.commit()
    return conn.execute("SELECT * FROM tasks WHERE id = last_insert_rowid()").fetchone()


def task_get(conn, task_id):
    """Get a task by id."""
    return conn.execute("SELECT * FROM tasks WHERE id = ?", (task_id,)).fetchone()


def task_list(conn, project_id=None, status=None):
    """List tasks, optionally filtered by project and/or status."""
    query = "SELECT t.*, p.name as project_name FROM tasks t JOIN projects p ON t.project_id = p.id WHERE 1=1"
    params = []
    if project_id is not None:
        query += " AND t.project_id = ?"
        params.append(project_id)
    if status:
        query += " AND t.status = ?"
        params.append(status)
    query += " ORDER BY t.created_at ASC"
    return conn.execute(query, params).fetchall()


def task_update(conn, task_id, **kwargs):
    """Update task fields."""
    allowed = {"title", "description", "plan_md_path", "log_path", "status"}
    updates = {k: v for k, v in kwargs.items() if k in allowed}
    if not updates:
        return task_get(conn, task_id)
    updates["updated_at"] = now()
    set_clause = ", ".join(f"{k} = ?" for k in updates)
    values = list(updates.values()) + [task_id]
    conn.execute(f"UPDATE tasks SET {set_clause} WHERE id = ?", values)
    conn.commit()
    return task_get(conn, task_id)


def task_delete(conn, task_id):
    """Delete a task."""
    task = task_get(conn, task_id)
    if task:
        conn.execute("DELETE FROM tasks WHERE id = ?", (task_id,))
        conn.commit()
    return task


# ─── Dependencies ────────────────────────────────────────────────────────────

def task_add_dep(conn, task_id, depends_on_id):
    """Add a dependency: task_id depends on depends_on_id."""
    conn.execute(
        "INSERT OR IGNORE INTO task_deps (task_id, depends_on_id) VALUES (?, ?)",
        (task_id, depends_on_id),
    )
    conn.commit()


def task_remove_dep(conn, task_id, depends_on_id):
    """Remove a dependency."""
    conn.execute(
        "DELETE FROM task_deps WHERE task_id = ? AND depends_on_id = ?",
        (task_id, depends_on_id),
    )
    conn.commit()


def task_get_deps(conn, task_id):
    """Get tasks that this task depends on."""
    return conn.execute(
        "SELECT t.* FROM tasks t JOIN task_deps d ON t.id = d.depends_on_id WHERE d.task_id = ?",
        (task_id,),
    ).fetchall()


def task_get_dependents(conn, task_id):
    """Get tasks that depend on this task."""
    return conn.execute(
        "SELECT t.* FROM tasks t JOIN task_deps d ON t.id = d.task_id WHERE d.depends_on_id = ?",
        (task_id,),
    ).fetchall()


def task_all_deps(conn, project_id=None):
    """Get all dependency pairs, optionally for a project."""
    query = """
        SELECT d.task_id, d.depends_on_id,
               t1.title as task_title, t2.title as dep_title,
               t1.status as task_status, t2.status as dep_status,
               t1.project_id as task_project_id, t2.project_id as dep_project_id
        FROM task_deps d
        JOIN tasks t1 ON d.task_id = t1.id
        JOIN tasks t2 ON d.depends_on_id = t2.id
    """
    params = []
    if project_id is not None:
        query += " WHERE t1.project_id = ? AND t2.project_id = ?"
        params.append(project_id)
        params.append(project_id)
    query += " ORDER BY t1.id"
    return conn.execute(query, params).fetchall()


def task_get_blocked(conn, project_id=None):
    """Get tasks that are blocked (have incomplete dependencies and aren't already done/blocked)."""
    query = """
        SELECT DISTINCT t.*, p.name as project_name
        FROM tasks t
        JOIN projects p ON t.project_id = p.id
        JOIN task_deps d ON t.id = d.task_id
        JOIN tasks dep ON d.depends_on_id = dep.id
        WHERE t.status NOT IN ('done', 'blocked')
          AND dep.status != 'done'
    """
    params = []
    if project_id is not None:
        query += " AND t.project_id = ?"
        params.append(project_id)
    query += " ORDER BY t.id"
    return conn.execute(query, params).fetchall()


def task_get_ready(conn, project_id=None):
    """Get tasks ready to build (all deps done, status is planned or pending)."""
    query = """
        SELECT t.*, p.name as project_name
        FROM tasks t
        JOIN projects p ON t.project_id = p.id
        WHERE t.status IN ('pending', 'planned')
          AND t.id NOT IN (
              SELECT d.task_id FROM task_deps d
              JOIN tasks dep ON d.depends_on_id = dep.id
              WHERE dep.status != 'done'
          )
    """
    params = []
    if project_id is not None:
        query += " AND t.project_id = ?"
        params.append(project_id)
    query += " ORDER BY t.created_at ASC"
    return conn.execute(query, params).fetchall()


# ─── Stats ───────────────────────────────────────────────────────────────────

def get_stats(conn):
    """Get overall stats."""
    return {
        "projects": conn.execute("SELECT COUNT(*) FROM projects").fetchone()[0],
        "ideas": conn.execute("SELECT COUNT(*) FROM ideas").fetchone()[0],
        "ideas_new": conn.execute("SELECT COUNT(*) FROM ideas WHERE status='new'").fetchone()[0],
        "tasks": conn.execute("SELECT COUNT(*) FROM tasks").fetchone()[0],
        "tasks_pending": conn.execute("SELECT COUNT(*) FROM tasks WHERE status='pending'").fetchone()[0],
        "tasks_planned": conn.execute("SELECT COUNT(*) FROM tasks WHERE status='planned'").fetchone()[0],
        "tasks_in_progress": conn.execute("SELECT COUNT(*) FROM tasks WHERE status='in_progress'").fetchone()[0],
        "tasks_done": conn.execute("SELECT COUNT(*) FROM tasks WHERE status='done'").fetchone()[0],
        "tasks_blocked": conn.execute("SELECT COUNT(*) FROM tasks WHERE status='blocked'").fetchone()[0],
    }
