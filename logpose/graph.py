"""Dependency graph rendering for logpose."""


def _render_single_project(conn, project_id, project_name=None):
    """Render an ASCII dependency graph for a single project's tasks.

    Returns a string suitable for terminal display.
    """
    from logpose.db import task_list, task_all_deps

    tasks = task_list(conn, project_id=project_id)
    deps = task_all_deps(conn, project_id=project_id)

    if not tasks:
        return ""

    # Build dependency lookup
    children_of = {}  # task_id -> [dependent_task_ids]
    parents_of = {}   # task_id -> [depends_on_task_ids]
    for d in deps:
        children_of.setdefault(d["depends_on_id"], []).append(d["task_id"])
        parents_of.setdefault(d["task_id"], []).append(d["depends_on_id"])

    # Find root tasks (no dependencies) and build levels
    task_map = {t["id"]: t for t in tasks}
    roots = [t for t in tasks if t["id"] not in parents_of]

    if not roots and tasks:
        # All tasks have deps — pick ones with fewest parents as roots
        roots = sorted(tasks, key=lambda t: len(parents_of.get(t["id"], [])))
        roots = roots[:1]

    # BFS to assign levels
    levels = {}
    visited = set()

    def assign_level(task_id, level):
        if task_id in visited:
            return
        visited.add(task_id)
        current = levels.get(task_id, -1)
        if level > current:
            levels[task_id] = level
        for child_id in children_of.get(task_id, []):
            assign_level(child_id, level + 1)

    for root in roots:
        assign_level(root["id"], 0)

    # Handle disconnected tasks
    for t in tasks:
        if t["id"] not in visited:
            assign_level(t["id"], 0)

    # Group tasks by level
    max_level = max(levels.values()) if levels else 0
    level_tasks = {i: [] for i in range(max_level + 1)}
    for t in tasks:
        lvl = levels.get(t["id"], 0)
        level_tasks[lvl].append(t)

    # Status indicators
    status_icon = {
        "pending": "○",
        "planned": "◐",
        "in_progress": "◉",
        "done": "●",
        "blocked": "⊘",
    }

    lines = []
    if project_name:
        lines.append(f"═══ {project_name} ═══")

    for lvl in sorted(level_tasks.keys()):
        for t in level_tasks[lvl]:
            icon = status_icon.get(t["status"], "?")
            deps_of = [f"#{d}" for d in parents_of.get(t["id"], [])]
            dep_str = f"  ← depends on: {', '.join(deps_of)}" if deps_of else ""
            indent = "  " * lvl
            lines.append(f"{indent}{icon} #{t['id']} [{t['status']}] {t['title']}{dep_str}")

    return "\n".join(lines)


def render_graph(conn, project_id=None):
    """Render ASCII dependency graphs for tasks.

    When project_id is given, renders that project's graph.
    When project_id is None, renders a separate graph for each project
    that has tasks, with project-name headers.
    """
    from logpose.db import task_list

    if project_id is not None:
        tasks = task_list(conn, project_id=project_id)
        if not tasks:
            return "(no tasks)"
        project_name = tasks[0]["project_name"] if tasks[0]["project_name"] else f"project {project_id}"
        return _render_single_project(conn, project_id, project_name)

    # All projects: render each separately
    tasks = task_list(conn)
    if not tasks:
        return "(no tasks)"

    # Collect unique project IDs and names from tasks
    project_map = {}  # project_id -> name
    for t in tasks:
        pid = t["project_id"]
        if pid not in project_map:
            project_map[pid] = t["project_name"] if t["project_name"] else f"project {pid}"

    blocks = []
    for pid in sorted(project_map.keys()):
        graph = _render_single_project(conn, pid, project_map[pid])
        if graph:
            blocks.append(graph)

    if not blocks:
        return "(no tasks)"
    return "\n\n".join(blocks) + "\n"


def render_graph_dot(conn, project_id=None):
    """Render dependency graph in DOT format (for Graphviz).

    Returns a string that can be piped to `dot -Tsvg` or similar.
    """
    from logpose.db import task_list, task_all_deps

    tasks = task_list(conn, project_id=project_id)
    deps = task_all_deps(conn, project_id=project_id)

    colors = {
        "pending": "#888888",
        "planned": "#3498db",
        "in_progress": "#f39c12",
        "done": "#27ae60",
        "blocked": "#e74c3c",
    }

    lines = ["digraph G {", "  rankdir=LR;", "  node [shape=box, style=rounded];"]
    for t in tasks:
        color = colors.get(t["status"], "#888888")
        label = f"#{t['id']} {t['title']} [{t['status']}]"
        lines.append(f'  t{t["id"]} [label="{label}", color="{color}", fontcolor="{color}"];')
    for d in deps:
        # Arrow from dependency to dependent (dep must be done first)
        lines.append(f'  t{d["depends_on_id"]} -> t{d["task_id"]};')
    lines.append("}")

    return "\n".join(lines) + "\n"
