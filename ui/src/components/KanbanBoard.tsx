import { useState } from "react";
import type { Project, Task, TaskStatus } from "../types";
import { TaskCard } from "./TaskCard";

const statuses: Array<{ id: TaskStatus; label: string }> = [
  { id: "pending", label: "Pending" },
  { id: "planned", label: "Planned" },
  { id: "in_progress", label: "In Progress" },
  { id: "blocked", label: "Blocked" },
  { id: "done", label: "Done" }
];

type Props = {
  tasks: Task[];
  projects: Project[];
};

export function KanbanBoard({ tasks, projects }: Props) {
  const [projectId, setProjectId] = useState("all");
  const filtered = projectId === "all" ? tasks : tasks.filter((task) => String(task.projectId) === projectId);

  return (
    <section>
      <div className="mb-4 flex justify-end">
        <select
          value={projectId}
          onChange={(event) => setProjectId(event.target.value)}
          className="panel bg-[var(--panel)] px-3 py-2 text-sm"
        >
          <option value="all">All projects</option>
          {projects.map((project) => (
            <option key={project.id} value={project.id}>
              {project.name}
            </option>
          ))}
        </select>
      </div>
      <div className="grid gap-3 xl:grid-cols-5">
        {statuses.map((status) => {
          const columnTasks = filtered.filter((task) => task.status === status.id);

          return (
            <div key={status.id} className="panel min-h-40 p-3">
              <div className="mb-3 flex items-center justify-between gap-2">
                <h2 className="text-sm font-medium">{status.label}</h2>
                <span className="badge">{columnTasks.length}</span>
              </div>
              <div className="space-y-2">
                {columnTasks.map((task) => (
                  <TaskCard key={task.id} task={task} />
                ))}
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}
