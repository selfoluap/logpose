#!/usr/bin/env python3
"""logpose CLI — the log pose to your next island."""

import argparse
import os
import sys

from logpose.db import (
    get_db,
    project_add, project_get, project_list, project_delete,
    idea_add, idea_get, idea_list, idea_update, idea_delete,
    task_add, task_get, task_list, task_update, task_delete,
    task_add_dep, task_remove_dep, task_get_deps, task_get_dependents,
    task_get_blocked, task_get_ready, get_stats,
    brain_add, brain_get, brain_list, brain_update, brain_delete, brain_tags,
    bug_add, bug_get, bug_get_by_source_url, bug_list, bug_update, bug_delete,
)
from logpose.graph import render_graph, render_graph_dot
from logpose.config import load_config, save_config, get_model_for_complexity, get_model_for_role, reset_config


def _resolve_project(conn, name_or_id):
    """Resolve a project identifier to its id. Accepts name or numeric id."""
    proj = project_get(conn, name_or_id)
    if not proj:
        # Try finding by name prefix
        for p in project_list(conn):
            if p["name"].startswith(name_or_id):
                return p
        print(f"Project '{name_or_id}' not found.")
        sys.exit(1)
    return proj


def _print_row(row, cols=None):
    """Print a sqlite3.Row as key: value pairs."""
    if row is None:
        print("(not found)")
        return
    keys = cols or row.keys()
    for k in keys:
        print(f"  {k}: {row[k]}")


def cmd_init(args):
    conn = get_db()
    stats = get_stats(conn)
    print(f"Database initialized: {conn.execute('PRAGMA database_list').fetchone()['file']}")
    print(f"Projects: {stats['projects']}, Ideas: {stats['ideas']}, Tasks: {stats['tasks']}")
    conn.close()


def cmd_status(args):
    conn = get_db()
    stats = get_stats(conn)
    print(f"Projects:       {stats['projects']}")
    print(f"Ideas:          {stats['ideas']}  (new: {stats['ideas_new']})")
    print(f"Brain ideas:    {stats['brain_ideas']}  (new: {stats['brain_new']})")
    print(f"Bugs:           {stats['bugs']}  (new: {stats['bugs_new']}, confirmed: {stats['bugs_confirmed']}, promoted: {stats['bugs_promoted']})")
    print(f"Tasks:          {stats['tasks']}")
    print(f"  pending:      {stats['tasks_pending']}")
    print(f"  planned:      {stats['tasks_planned']}")
    print(f"  in_progress:  {stats['tasks_in_progress']}")
    print(f"  done:         {stats['tasks_done']}")
    print(f"  blocked:      {stats['tasks_blocked']}")
    conn.close()

# ─── Project commands ────────────────────────────────────────────────────────

def cmd_project_add(args):
    conn = get_db()
    agents_md = None
    # Auto-detect AGENTS.md in project path
    if os.path.isdir(args.path):
        for candidate in ["AGENTS.md", "agents.md", "CLAUDE.md", "claude.md"]:
            p = os.path.join(args.path, candidate)
            if os.path.isfile(p):
                agents_md = p
                break
    proj = project_add(conn, args.name, os.path.abspath(args.path), agents_md_path=agents_md)
    print(f"Project '{proj['name']}' added (id={proj['id']})")
    if agents_md:
        print(f"  AGENTS.md: {agents_md}")
    conn.close()

def cmd_project_list(args):
    conn = get_db()
    for p in project_list(conn):
        idea_count = len(idea_list(conn, project_id=p["id"]))
        task_count = len(task_list(conn, project_id=p["id"]))
        bug_count = len(bug_list(conn, project_id=p["id"]))
        print(f"  #{p['id']} {p['name']}  ({task_count} tasks, {idea_count} ideas, {bug_count} bugs)")
        print(f"       path: {p['path']}")
    conn.close()

def cmd_project_show(args):
    conn = get_db()
    proj = _resolve_project(conn, args.name)
    _print_row(proj, ["id", "name", "path", "agents_md_path", "created_at"])
    ideas = idea_list(conn, project_id=proj["id"])
    tasks = task_list(conn, project_id=proj["id"])
    if ideas:
        print(f"\n  Ideas ({len(ideas)}):")
        for i in ideas:
            print(f"    #{i['id']} [{i['status']}] {i['title']}")
    if tasks:
        print(f"\n  Tasks ({len(tasks)}):")
        for t in tasks:
            print(f"    #{t['id']} [{t['status']}] {t['title']}")
    bugs = bug_list(conn, project_id=proj["id"])
    if bugs:
        print(f"\n  Bugs ({len(bugs)}):")
        for b in bugs:
            print(f"    #{b['id']} [{b['status']}] {b['title']}")
    conn.close()

def cmd_project_rm(args):
    conn = get_db()
    proj = _resolve_project(conn, args.name)
    project_delete(conn, proj["id"])
    print(f"Project '{proj['name']}' and all its ideas/tasks removed.")
    conn.close()

# ─── Idea commands ───────────────────────────────────────────────────────────

def cmd_idea_add(args):
    conn = get_db()
    proj = _resolve_project(conn, args.project)
    desc = args.description
    if desc is None and not sys.stdin.isatty():
        desc = sys.stdin.read().strip()
    idea = idea_add(conn, proj["id"], args.title, description=desc, complexity=args.complexity)
    complexity_str = f" (complexity: {args.complexity})" if args.complexity else ""
    print(f"Idea #{idea['id']} '{idea['title']}' added to project '{proj['name']}'{complexity_str}")
    conn.close()


def cmd_idea_list(args):
    conn = get_db()
    proj_id = None
    if args.project:
        proj = _resolve_project(conn, args.project)
        proj_id = proj["id"]
    ideas = idea_list(conn, project_id=proj_id, status=args.status)
    if not ideas:
        print("(no ideas)")
    for i in ideas:
        complexity_str = f" C:{i['complexity']}" if i["complexity"] else ""
        desc_preview = (i["description"] or "")[:80]
        print(f"  #{i['id']} [{i['status']}] {i['title']}  ({i['project_name']}){complexity_str}")
        if desc_preview:
            print(f"       {desc_preview}")
    conn.close()


def cmd_idea_show(args):
    conn = get_db()
    idea = idea_get(conn, args.id)
    _print_row(idea, ["id", "project_id", "title", "description", "refined_description", "complexity", "status", "created_at"])
    if idea and idea["refined_description"]:
        print(f"\n  refined_description:\n{idea['refined_description']}")
    conn.close()


def cmd_idea_refine(args):
    """Mark an idea as refined. Hermes does the actual refinement in conversation,
    then calls this command to record the refined description."""
    conn = get_db()
    idea = idea_get(conn, args.id)
    if not idea:
        print(f"Idea #{args.id} not found.")
        sys.exit(1)
    desc = args.description
    if desc is None and not sys.stdin.isatty():
        desc = sys.stdin.read().strip()
    updates = {"status": "refined", "refined_description": desc}
    if args.complexity is not None:
        updates["complexity"] = args.complexity
    idea_update(conn, args.id, **updates)
    print(f"Idea #{args.id} '{idea['title']}' marked as refined.")
    if args.complexity is not None:
        print(f"  complexity: {args.complexity}")
    conn.close()


def cmd_idea_refine_ai(args):
    """Use opencode to refine an idea into a well-structured specification."""
    conn = get_db()
    idea = idea_get(conn, args.id)
    if not idea:
        print(f"Idea #{args.id} not found.")
        sys.exit(1)

    proj = project_get(conn, idea["project_id"])
    model = get_model_for_role("refine")
    print(f"[logpose] Model: {model} (role: refine)")

    from logpose.opencode import run_refine
    refined = run_refine(
        idea_id=idea["id"],
        idea_title=idea["title"],
        idea_description=idea["description"] or idea["title"],
        project_path=proj["path"],
        model=model,
    )

    if refined:
        idea_update(conn, args.id, status="refined", refined_description=refined)
        print(f"\nIdea #{args.id} '{idea['title']}' refined and marked as refined.")
    else:
        print(f"\nRefinement failed for idea #{args.id}. Status unchanged.")
    conn.close()


def cmd_idea_convert(args):
    """Convert an idea into a task."""
    conn = get_db()
    idea = idea_get(conn, args.id)
    if not idea:
        print(f"Idea #{args.id} not found.")
        sys.exit(1)
    if idea["status"] == "converted":
        print(f"Idea #{args.id} is already converted.")
        sys.exit(1)

    desc = idea["refined_description"] or idea["description"] or ""
    complexity = idea["complexity"]
    task = task_add(conn, idea["project_id"], idea["title"], description=desc, idea_id=idea["id"], complexity=complexity)
    idea_update(conn, args.id, status="converted")
    msg = f"Idea #{args.id} '{idea['title']}' → Task #{task['id']}"
    if complexity:
        msg += f" (complexity: {complexity})"
    print(msg)
    conn.close()


def cmd_idea_rm(args):
    conn = get_db()
    idea = idea_delete(conn, args.id)
    if idea:
        print(f"Idea #{args.id} removed.")
    else:
        print(f"Idea #{args.id} not found.")
    conn.close()

# ─── Bug commands ─────────────────────────────────────────────────────────────

def cmd_bug_add(args):
    conn = get_db()
    proj = _resolve_project(conn, args.project)
    desc = args.description
    if desc is None and not sys.stdin.isatty():
        desc = sys.stdin.read().strip()
    bug = bug_add(
        conn,
        proj["id"],
        args.title,
        description=desc,
        source_url=args.source_url,
        count=args.count,
        first_seen=args.first_seen,
        last_seen=args.last_seen,
        level=args.level,
    )
    print(f"Bug #{bug['id']} [{bug['status']}] \'{bug['title']}\' in project \'{proj['name']}\'")
    conn.close()


def cmd_bug_list(args):
    conn = get_db()
    proj_id = None
    if args.project:
        proj = _resolve_project(conn, args.project)
        proj_id = proj["id"]
    bugs = bug_list(conn, project_id=proj_id, status=args.status)
    if not bugs:
        print("(no bugs)")
    for b in bugs:
        bits = []
        if b["level"]:
            bits.append(b["level"])
        if b["count"]:
            bits.append(f"{b['count']} events")
        meta = f" ({', '.join(bits)})" if bits else ""
        print(f"  #{b['id']} [{b['status']}] {b['title']}  ({b['project_name']}){meta}")
        if b["source_url"]:
            print(f"       {b['source_url']}")
    conn.close()


def cmd_bug_show(args):
    conn = get_db()
    bug = bug_get(conn, args.id)
    _print_row(bug, ["id", "project_id", "task_id", "title", "description", "source_url", "count", "first_seen", "last_seen", "level", "status", "created_at", "updated_at"])
    conn.close()


def cmd_bug_status(args):
    valid = ["new", "confirmed", "promoted"]
    if args.status not in valid:
        print(f"Invalid status \'{args.status}\'. Valid: {', '.join(valid)}")
        sys.exit(1)
    conn = get_db()
    bug = bug_update(conn, args.id, status=args.status)
    print(f"Bug #{args.id} status → {args.status}" if bug else f"Bug #{args.id} not found.")
    conn.close()


def cmd_bug_promote(args):
    conn = get_db()
    bug = bug_get(conn, args.id)
    if not bug:
        print(f"Bug #{args.id} not found.")
        sys.exit(1)
    if bug["status"] == "promoted":
        print(f"Bug #{args.id} is already promoted.")
        sys.exit(1)
    desc = bug["description"] or ""
    task = task_add(conn, bug["project_id"], bug["title"], description=desc, complexity=args.complexity)
    bug_update(conn, args.id, status="promoted", task_id=task["id"])
    print(f"Bug #{args.id} \'{bug['title']}\' → Task #{task['id']}")
    conn.close()


def cmd_bug_rm(args):
    conn = get_db()
    bug = bug_delete(conn, args.id)
    print(f"Bug #{args.id} removed." if bug else f"Bug #{args.id} not found.")
    conn.close()


# ─── Task commands ───────────────────────────────────────────────────────────

def cmd_task_add(args):
    conn = get_db()
    proj = _resolve_project(conn, args.project)
    desc = args.description
    if desc is None and not sys.stdin.isatty():
        desc = sys.stdin.read().strip()
    task = task_add(conn, proj["id"], args.title, description=desc, complexity=args.complexity)
    complexity_str = f" (complexity: {args.complexity})" if args.complexity else ""
    print(f"Task #{task['id']} '{task['title']}' added to project '{proj['name']}'{complexity_str}")
    conn.close()


def cmd_task_list(args):
    conn = get_db()
    proj_id = None
    if args.project:
        proj = _resolve_project(conn, args.project)
        proj_id = proj["id"]
    tasks = task_list(conn, project_id=proj_id, status=args.status)
    if not tasks:
        print("(no tasks)")
    for t in tasks:
        deps = task_get_deps(conn, t["id"])
        dep_str = ""
        if deps:
            dep_ids = [f"#{d['id']}" for d in deps]
            dep_str = f"  ← deps: {', '.join(dep_ids)}"
        complexity_str = f" C:{t['complexity']}" if t["complexity"] else ""
        print(f"  #{t['id']} [{t['status']}] {t['title']}  ({t['project_name']}){complexity_str}{dep_str}")
    conn.close()


def cmd_task_show(args):
    conn = get_db()
    task = task_get(conn, args.id)
    if not task:
        print(f"Task #{args.id} not found.")
        sys.exit(1)
    _print_row(task, ["id", "project_id", "idea_id", "title", "description", "complexity", "plan_md_path", "log_path", "status", "created_at", "updated_at"])

    deps = task_get_deps(conn, args.id)
    if deps:
        print(f"\n  Depends on ({len(deps)}):")
        for d in deps:
            print(f"    #{d['id']} [{d['status']}] {d['title']}")

    dependents = task_get_dependents(conn, args.id)
    if dependents:
        print(f"\n  Dependents ({len(dependents)}):")
        for d in dependents:
            print(f"    #{d['id']} [{d['status']}] {d['title']}")
    conn.close()


def cmd_task_plan(args):
    """Run opencode plan agent for this task. Uses the 'plan' role model."""
    conn = get_db()
    task = task_get(conn, args.id)
    if not task:
        print(f"Task #{args.id} not found.")
        sys.exit(1)

    proj = project_get(conn, task["project_id"])
    model = get_model_for_role("plan")
    print(f"[logpose] Model: {model} (role: plan)")

    from logpose.opencode import run_plan
    plan_path = run_plan(
        task_id=task["id"],
        task_title=task["title"],
        task_description=task["description"] or task["title"],
        project_path=proj["path"],
        model=model,
    )

    if plan_path:
        task_update(conn, args.id, plan_md_path=plan_path, status="planned")
        print(f"Task #{args.id} status: {task['status']} → planned")
    else:
        print(f"Task #{args.id} planning failed — no output from opencode.")
    conn.close()


def cmd_task_build(args):
    """Run opencode build for this task. Uses complexity-based model selection."""
    conn = get_db()
    task = task_get(conn, args.id)
    if not task:
        print(f"Task #{args.id} not found.")
        sys.exit(1)

    # Check dependencies
    deps = task_get_deps(conn, args.id)
    for d in deps:
        if d["status"] != "done":
            print(f"ERROR: Task #{args.id} depends on #{d['id']} '{d['title']}' which is not done (status: {d['status']}).")
            print("Build all dependencies first, or use --force to override.")
            if not args.force:
                sys.exit(1)
            print("Proceeding with --force...")

    proj = project_get(conn, task["project_id"])

    model = get_model_for_complexity(task["complexity"])
    print(f"[logpose] Model: {model} (complexity: {task['complexity'] or 'default(3)'})")

    task_update(conn, args.id, status="in_progress")
    print(f"Task #{args.id} status: {task['status']} → in_progress")

    from logpose.opencode import run_build
    exit_code, log_path = run_build(
        task_id=task["id"],
        task_title=task["title"],
        task_description=task["description"] or task["title"],
        project_path=proj["path"],
        plan_md_path=task["plan_md_path"],
        model=model,
    )

    # Save the log path to the task record
    if log_path:
        task_update(conn, args.id, log_path=log_path)

    if exit_code == 0:
        task_update(conn, args.id, status="done")
        print(f"Task #{args.id} status: in_progress → done")
    else:
        task_update(conn, args.id, status="blocked")
        print(f"Task #{args.id} status: in_progress → blocked (build failed)")
    conn.close()


def cmd_task_review(args):
    """Run opencode review agent for this task. Uses the 'review' role model."""
    conn = get_db()
    task = task_get(conn, args.id)
    if not task:
        print(f"Task #{args.id} not found.")
        sys.exit(1)

    proj = project_get(conn, task["project_id"])
    model = get_model_for_role("review")
    print(f"[logpose] Model: {model} (role: review)")

    from logpose.opencode import run_review
    review_path = run_review(
        task_id=task["id"],
        task_title=task["title"],
        task_description=task["description"] or task["title"],
        project_path=proj["path"],
        plan_md_path=task["plan_md_path"],
        model=model,
    )

    if review_path:
        print(f"Review log: {review_path}")
    else:
        print(f"Review failed for task #{args.id}.")
    conn.close()


def cmd_task_status(args):
    conn = get_db()
    valid_statuses = ["pending", "planned", "in_progress", "done", "blocked"]
    if args.status not in valid_statuses:
        print(f"Invalid status '{args.status}'. Valid: {', '.join(valid_statuses)}")
        sys.exit(1)
    task = task_update(conn, args.id, status=args.status)
    if task:
        print(f"Task #{args.id} status → {args.status}")
    else:
        print(f"Task #{args.id} not found.")
    conn.close()


def cmd_task_deps(args):
    """Set dependencies for a task. Replaces all existing deps."""
    conn = get_db()
    task = task_get(conn, args.id)
    if not task:
        print(f"Task #{args.id} not found.")
        sys.exit(1)

    # Validate all dep ids exist
    dep_ids = []
    for did in args.dep_ids:
        dep = task_get(conn, did)
        if not dep:
            print(f"Dependency task #{did} not found.")
            sys.exit(1)
        if dep["project_id"] != task["project_id"]:
            print(f"ERROR: Task #{did} is in a different project. Cross-project dependencies are not allowed.")
            sys.exit(1)
        dep_ids.append(dep["id"])

    # Check for cycles (simple: no task can depend on something that transitively depends on it)
    if _would_cycle(conn, task["id"], dep_ids):
        print("ERROR: This would create a dependency cycle.")
        sys.exit(1)

    # Remove existing deps
    conn.execute("DELETE FROM task_deps WHERE task_id = ?", (task["id"],))

    # Add new deps
    for did in dep_ids:
        task_add_dep(conn, task["id"], did)
    conn.commit()
    print(f"Task #{args.id} now depends on: {[f'#{d}' for d in dep_ids] if dep_ids else '(none)'}")
    conn.close()


def cmd_task_undep(args):
    conn = get_db()
    task_remove_dep(conn, args.id, args.dep_id)
    print(f"Removed dependency: task #{args.id} no longer depends on #{args.dep_id}")
    conn.close()


def cmd_task_rm(args):
    conn = get_db()
    task = task_delete(conn, args.id)
    if task:
        print(f"Task #{args.id} removed.")
    else:
        print(f"Task #{args.id} not found.")
    conn.close()


def cmd_task_watch(args):
    """Tail the build log for a task in real-time, or cat it if the task is no longer running."""
    import time

    conn = get_db()
    task = task_get(conn, args.id)
    if not task:
        print(f"Task #{args.id} not found.")
        sys.exit(1)

    log_path = task["log_path"]
    if not log_path:
        print("No log file for this task")
        conn.close()
        sys.exit(1)

    if not os.path.isfile(log_path):
        print(f"Log file not found: {log_path}")
        conn.close()
        sys.exit(1)

    proj = project_get(conn, task["project_id"])
    proj_name = proj["name"] if proj else "?"

    # Print header
    print(f"=== Task #{task['id']}: {task['title']} ===")
    print(f"    Status: {task['status']}  |  Project: {proj_name}")
    print(f"    Log: {log_path}")
    print()

    conn.close()

    # If task is still in progress, tail the log
    if task["status"] == "in_progress":
        try:
            with open(log_path, "r") as f:
                # First, print existing content
                for line in f:
                    print(line, end="")
                # Then tail for new lines
                while True:
                    line = f.readline()
                    if line:
                        print(line, end="")
                    else:
                        time.sleep(0.5)
        except KeyboardInterrupt:
            print()
            sys.exit(0)
    else:
        # Task is done/blocked/etc — just cat the entire log
        with open(log_path, "r") as f:
            for line in f:
                print(line, end="")


# ─── Graph commands ──────────────────────────────────────────────────────────

def cmd_graph(args):
    conn = get_db()
    proj_id = None
    if args.project:
        proj = _resolve_project(conn, args.project)
        proj_id = proj["id"]

    if args.format == "dot":
        print(render_graph_dot(conn, project_id=proj_id))
    else:
        if proj_id:
            bugs = bug_list(conn, project_id=proj_id)
            print(f"  Bugs: {len(bugs)}")
        print(render_graph(conn, project_id=proj_id))
    conn.close()


def cmd_next(args):
    """Show next ready-to-build tasks."""
    conn = get_db()
    proj_id = None
    if args.project:
        proj = _resolve_project(conn, args.project)
        proj_id = proj["id"]
    ready = task_get_ready(conn, project_id=proj_id)
    if not ready:
        print("(no tasks ready to build)")
    for t in ready:
        proj_name = t["project_name"] if t["project_name"] else "?"
        plan_status = "has plan" if t["plan_md_path"] else "no plan"
        print(f"  #{t['id']} [{t['status']}] {t['title']}  ({proj_name}, {plan_status})")
    conn.close()


def cmd_blocked(args):
    """Show blocked tasks."""
    conn = get_db()
    proj_id = None
    if args.project:
        proj = _resolve_project(conn, args.project)
        proj_id = proj["id"]
    blocked = task_get_blocked(conn, project_id=proj_id)
    if not blocked:
        print("(no blocked tasks)")
    for t in blocked:
        proj_name = t["project_name"] if t["project_name"] else "?"
        deps = task_get_deps(conn, t["id"])
        dep_str = ", ".join(f"#{d['id']} [{d['status']}]" for d in deps)
        print(f"  #{t['id']} [{t['status']}] {t['title']}  ({proj_name})")
        print(f"       blocked by: {dep_str}")
    conn.close()

# ─── Brain commands ──────────────────────────────────────────────────────────

def cmd_brain_add(args):
    conn = get_db()
    desc = args.description
    if desc is None and not sys.stdin.isatty():
        desc = sys.stdin.read().strip()
    idea = brain_add(conn, args.title, description=desc, tag=args.tag)
    tag_str = f" [{args.tag}]" if args.tag else ""
    print(f"Brain #{idea['id']} '{idea['title']}' added{tag_str}")
    conn.close()


def cmd_brain_list(args):
    conn = get_db()
    ideas = brain_list(conn, tag=args.tag, status=args.status)
    if not ideas:
        print("(no brain ideas)")
    for i in ideas:
        tag_str = f" [{i['tag']}]" if i["tag"] else ""
        desc_preview = (i["description"] or "")[:80]
        print(f"  #{i['id']} [{i['status']}] {i['title']}{tag_str}")
        if desc_preview:
            print(f"       {desc_preview}")
    conn.close()


def cmd_brain_show(args):
    conn = get_db()
    idea = brain_get(conn, args.id)
    if not idea:
        print(f"Brain #{args.id} not found.")
        conn.close()
        return
    _print_row(idea, ["id", "title", "description", "tag", "status", "created_at", "updated_at"])
    conn.close()


def cmd_brain_tag(args):
    conn = get_db()
    idea = brain_get(conn, args.id)
    if not idea:
        print(f"Brain #{args.id} not found.")
        conn.close()
        return
    old_tag = idea["tag"] or "(none)"
    brain_update(conn, args.id, tag=args.tag)
    print(f"Brain #{args.id} tag: {old_tag} → {args.tag}")
    conn.close()


def cmd_brain_status(args):
    conn = get_db()
    valid_statuses = ["new", "exploring", "abandoned", "done"]
    if args.status not in valid_statuses:
        print(f"Invalid status '{args.status}'. Valid: {', '.join(valid_statuses)}")
        sys.exit(1)
    idea = brain_get(conn, args.id)
    if not idea:
        print(f"Brain #{args.id} not found.")
        conn.close()
        return
    brain_update(conn, args.id, status=args.status)
    print(f"Brain #{args.id} status: {idea['status']} → {args.status}")
    conn.close()


def cmd_brain_tags(args):
    conn = get_db()
    tags = brain_tags(conn)
    if not tags:
        print("(no tags)")
    for t in tags:
        print(f"  {t['tag']}: {t['count']}")
    conn.close()


def cmd_brain_rm(args):
    conn = get_db()
    idea = brain_delete(conn, args.id)
    if idea:
        print(f"Brain #{args.id} '{idea['title']}' removed.")
    else:
        print(f"Brain #{args.id} not found.")
    conn.close()


# ─── Config commands ────────────────────────────────────────────────────────

def cmd_config_show(args):
    """Show current model mapping configuration."""
    config = load_config()
    models = config.get("models", {})

    print("Pipeline role → Model mapping:")
    print(f"  refine:  {models.get('refine', '(not set)')}")
    print(f"  plan:    {models.get('plan', '(not set)')}")
    print(f"  review:  {models.get('review', '(not set)')}")
    print()
    print("Complexity → Build model mapping:")
    for level in range(1, 6):
        model = models.get(str(level), "(not set)")
        print(f"  {level}: {model}")


def cmd_config_set(args):
    """Set the model for a complexity level or pipeline role."""
    config = load_config()
    config.setdefault("models", {})

    # Check if key is a role (refine, plan, review) or a complexity level (1-5)
    if args.key in ("refine", "plan", "review"):
        config["models"][args.key] = args.model
        save_config(config)
        print(f"Set role '{args.key}' → {args.model}")
    elif args.key.isdigit() and 1 <= int(args.key) <= 5:
        config["models"][args.key] = args.model
        save_config(config)
        print(f"Set complexity {args.key} → {args.model}")
    else:
        print(f"Invalid key '{args.key}'. Use a complexity level (1-5) or a role (refine, plan, review).")
        sys.exit(1)


def cmd_config_reset(args):
    """Reset model mapping to defaults."""
    from logpose.config import DEFAULT_CONFIG
    import copy
    save_config(copy.deepcopy(DEFAULT_CONFIG))
    print("Config reset to defaults.")

# ─── Sentry commands ──────────────────────────────────────────────────────────

def cmd_sentry_map(args):
    """Map a Sentry project slug to a logpose project name."""
    from logpose.config import set_sentry_project_mapping
    conn = get_db()
    proj = _resolve_project(conn, args.logpose_project)
    set_sentry_project_mapping(args.sentry_project, proj["name"])
    print(f"Sentry project \'{args.sentry_project}\' → logpose project \'{proj['name']}\'")
    conn.close()


# ─── Utility ─────────────────────────────────────────────────────────────────

def _would_cycle(conn, task_id, dep_ids):
    """Check if adding deps would create a cycle."""
    # Build adjacency: depends_on -> task (reverse direction for cycle detection)
    all_deps = conn.execute(
        "SELECT task_id, depends_on_id FROM task_deps"
    ).fetchall()

    # Simulate new deps
    adj = {}  # depends_on_id -> [task_ids that depend on it]
    for d in all_deps:
        adj.setdefault(d["depends_on_id"], []).append(d["task_id"])

    # Check: if any dep_id can reach task_id through the graph, it's a cycle
    def can_reach(start, target, visited=None):
        if visited is None:
            visited = set()
        if start == target:
            return True
        if start in visited:
            return False
        visited.add(start)
        for child in adj.get(start, []):
            if can_reach(child, target, visited):
                return True
        # Also check the new deps we're about to add
        for did in dep_ids:
            if did == start and can_reach(task_id, target, visited):
                return True
        return False

    for did in dep_ids:
        if can_reach(task_id, did):
            return True
    return False

# ─── Main CLI ────────────────────────────────────────────────────────────────

def main():
    parser = argparse.ArgumentParser(
        description="logpose — Track projects, ideas, and tasks. The log pose to your next island.",
    )
    sub = parser.add_subparsers(dest="command", help="Available commands")

    # init
    sub.add_parser("init", help="Initialize the database").set_defaults(func=cmd_init)
    sub.add_parser("status", help="Show overall stats").set_defaults(func=cmd_status)

    # project
    p_proj = sub.add_parser("project", help="Project management")
    psub = p_proj.add_subparsers(dest="subcommand")
    pa = psub.add_parser("add", help="Register a project")
    pa.add_argument("name")
    pa.add_argument("path")
    pa.set_defaults(func=cmd_project_add)
    psub.add_parser("list", help="List projects").set_defaults(func=cmd_project_list)
    ps = psub.add_parser("show", help="Show project details")
    ps.add_argument("name")
    ps.set_defaults(func=cmd_project_show)
    pr = psub.add_parser("rm", help="Remove a project")
    pr.add_argument("name")
    pr.set_defaults(func=cmd_project_rm)

    # idea
    p_idea = sub.add_parser("idea", help="Idea management")
    isub = p_idea.add_subparsers(dest="subcommand")
    ia = isub.add_parser("add", help="Add an idea")
    ia.add_argument("project")
    ia.add_argument("title")
    ia.add_argument("-d", "--description", default=None)
    ia.add_argument("-c", "--complexity", type=int, choices=[1, 2, 3, 4, 5], default=None, help="Complexity score (1-5)")
    ia.set_defaults(func=cmd_idea_add)
    il = isub.add_parser("list", help="List ideas")
    il.add_argument("project", nargs="?", default=None)
    il.add_argument("-s", "--status", default=None, choices=["new", "refined", "converted"])
    il.set_defaults(func=cmd_idea_list)
    is_ = isub.add_parser("show", help="Show idea details")
    is_.add_argument("id", type=int)
    is_.set_defaults(func=cmd_idea_show)
    ir = isub.add_parser("refine", help="Mark idea as refined (manual)")
    ir.add_argument("id", type=int)
    ir.add_argument("-d", "--description", default=None, help="Refined description")
    ir.add_argument("-c", "--complexity", type=int, choices=[1, 2, 3, 4, 5], default=None, help="Complexity score (1-5)")
    ir.set_defaults(func=cmd_idea_refine)
    ira = isub.add_parser("refine-ai", help="Refine idea using opencode (AI)")
    ira.add_argument("id", type=int)
    ira.set_defaults(func=cmd_idea_refine_ai)
    ic = isub.add_parser("convert", help="Convert idea to task")
    ic.add_argument("id", type=int)
    ic.set_defaults(func=cmd_idea_convert)
    irm = isub.add_parser("rm", help="Remove an idea")
    irm.add_argument("id", type=int)
    irm.set_defaults(func=cmd_idea_rm)

    # bug
    p_bug = sub.add_parser("bug", help="Bug management")
    bsub = p_bug.add_subparsers(dest="subcommand")

    ba = bsub.add_parser("add", help="Add or update a bug")
    ba.add_argument("project")
    ba.add_argument("title")
    ba.add_argument("-d", "--description", default=None)
    ba.add_argument("--source-url", default=None)
    ba.add_argument("--count", type=int, default=1)
    ba.add_argument("--first-seen", default=None)
    ba.add_argument("--last-seen", default=None)
    ba.add_argument("--level", choices=["fatal", "error", "warning", "info"], default=None)
    ba.set_defaults(func=cmd_bug_add)

    bl = bsub.add_parser("list", help="List bugs")
    bl.add_argument("project", nargs="?", default=None)
    bl.add_argument("-s", "--status", choices=["new", "confirmed", "promoted"], default=None)
    bl.set_defaults(func=cmd_bug_list)

    bs = bsub.add_parser("show", help="Show bug details")
    bs.add_argument("id", type=int)
    bs.set_defaults(func=cmd_bug_show)

    bst = bsub.add_parser("status", help="Update bug status")
    bst.add_argument("id", type=int)
    bst.add_argument("status")
    bst.set_defaults(func=cmd_bug_status)

    bp = bsub.add_parser("promote", help="Convert bug to task")
    bp.add_argument("id", type=int)
    bp.add_argument("-c", "--complexity", type=int, choices=[1, 2, 3, 4, 5], default=None)
    bp.set_defaults(func=cmd_bug_promote)

    brm = bsub.add_parser("rm", help="Remove a bug")
    brm.add_argument("id", type=int)
    brm.set_defaults(func=cmd_bug_rm)

    # task
    p_task = sub.add_parser("task", help="Task management")
    tsub = p_task.add_subparsers(dest="subcommand")
    ta = tsub.add_parser("add", help="Add a task")
    ta.add_argument("project")
    ta.add_argument("title")
    ta.add_argument("-d", "--description", default=None)
    ta.add_argument("-c", "--complexity", type=int, choices=[1, 2, 3, 4, 5], default=None, help="Complexity score (1-5)")
    ta.set_defaults(func=cmd_task_add)
    tl = tsub.add_parser("list", help="List tasks")
    tl.add_argument("project", nargs="?", default=None)
    tl.add_argument("-s", "--status", default=None, choices=["pending", "planned", "in_progress", "done", "blocked"])
    tl.set_defaults(func=cmd_task_list)
    ts = tsub.add_parser("show", help="Show task details")
    ts.add_argument("id", type=int)
    ts.set_defaults(func=cmd_task_show)
    tp = tsub.add_parser("plan", help="Run opencode plan agent for this task")
    tp.add_argument("id", type=int)
    tp.set_defaults(func=cmd_task_plan)
    tb = tsub.add_parser("build", help="Run opencode build for this task")
    tb.add_argument("id", type=int)
    tb.add_argument("--force", action="store_true", help="Build even if deps aren't done")
    tb.set_defaults(func=cmd_task_build)
    trv = tsub.add_parser("review", help="Run opencode review agent for this task")
    trv.add_argument("id", type=int)
    trv.set_defaults(func=cmd_task_review)
    tst = tsub.add_parser("status", help="Update task status")
    tst.add_argument("id", type=int)
    tst.add_argument("status")
    tst.set_defaults(func=cmd_task_status)
    td = tsub.add_parser("deps", help="Set task dependencies")
    td.add_argument("id", type=int)
    td.add_argument("dep_ids", nargs="*", type=int, default=[])
    td.set_defaults(func=cmd_task_deps)
    tu = tsub.add_parser("undep", help="Remove a dependency")
    tu.add_argument("id", type=int)
    tu.add_argument("dep_id", type=int)
    tu.set_defaults(func=cmd_task_undep)
    trm = tsub.add_parser("rm", help="Remove a task")
    trm.add_argument("id", type=int)
    trm.set_defaults(func=cmd_task_rm)
    tw = tsub.add_parser("watch", help="Tail the build log for a task")
    tw.add_argument("id", type=int)
    tw.set_defaults(func=cmd_task_watch)

    # sentry
    p_sentry = sub.add_parser("sentry", help="Sentry integration config")
    ssub = p_sentry.add_subparsers(dest="subcommand")
    sm = ssub.add_parser("map", help="Map Sentry project slug to logpose project")
    sm.add_argument("sentry_project")
    sm.add_argument("logpose_project")
    sm.set_defaults(func=cmd_sentry_map)

    # config
    p_config = sub.add_parser("config", help="Model mapping configuration")
    csub = p_config.add_subparsers(dest="subcommand")
    cs = csub.add_parser("show", help="Show current model mapping")
    cs.set_defaults(func=cmd_config_show)
    cset = csub.add_parser("set", help="Set model for a complexity level or pipeline role")
    cset.add_argument("key", help="Complexity level (1-5) or role (refine, plan, review)")
    cset.add_argument("model", help="Model string (e.g. openai/gpt-5.5)")
    cset.set_defaults(func=cmd_config_set)
    creset = csub.add_parser("reset", help="Reset to default model mapping")
    creset.set_defaults(func=cmd_config_reset)

    # graph
    p_graph = sub.add_parser("graph", help="Dependency graph")
    p_graph.add_argument("project", nargs="?", default=None)
    p_graph.add_argument("--format", "-f", default="ascii", choices=["ascii", "dot"])
    p_graph.set_defaults(func=cmd_graph)

    # next / blocked
    p_next = sub.add_parser("next", help="Show next ready-to-build tasks")
    p_next.add_argument("project", nargs="?", default=None)
    p_next.set_defaults(func=cmd_next)
    p_blk = sub.add_parser("blocked", help="Show blocked tasks")
    p_blk.add_argument("project", nargs="?", default=None)
    p_blk.set_defaults(func=cmd_blocked)

    # brain
    p_brain = sub.add_parser("brain", help="Personal idea inbox (project-less ideas)")
    bsub = p_brain.add_subparsers(dest="subcommand")
    ba = bsub.add_parser("add", help="Add a brain idea")
    ba.add_argument("title")
    ba.add_argument("-d", "--description", default=None)
    ba.add_argument("-t", "--tag", default=None, help="Category tag (e.g. go, learning, web)")
    ba.set_defaults(func=cmd_brain_add)
    bl = bsub.add_parser("list", help="List brain ideas")
    bl.add_argument("-t", "--tag", default=None, help="Filter by tag")
    bl.add_argument("-s", "--status", default=None, choices=["new", "exploring", "abandoned", "done"])
    bl.set_defaults(func=cmd_brain_list)
    bs = bsub.add_parser("show", help="Show brain idea details")
    bs.add_argument("id", type=int)
    bs.set_defaults(func=cmd_brain_show)
    btag = bsub.add_parser("tag", help="Set tag on a brain idea")
    btag.add_argument("id", type=int)
    btag.add_argument("tag", help="New tag (e.g. go, learning, web)")
    btag.set_defaults(func=cmd_brain_tag)
    bstatus = bsub.add_parser("status", help="Set status on a brain idea")
    bstatus.add_argument("id", type=int)
    bstatus.add_argument("status", choices=["new", "exploring", "abandoned", "done"])
    bstatus.set_defaults(func=cmd_brain_status)
    btags = bsub.add_parser("tags", help="List all tags with counts")
    btags.set_defaults(func=cmd_brain_tags)
    brm = bsub.add_parser("rm", help="Remove a brain idea")
    brm.add_argument("id", type=int)
    brm.set_defaults(func=cmd_brain_rm)

    args = parser.parse_args()

    if not hasattr(args, "func"):
        # Default: show status
        cmd_status(args)
        return

    args.func(args)


if __name__ == "__main__":
    main()