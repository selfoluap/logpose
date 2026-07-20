import type { Task } from "../types";

export function TaskCard({ task }: { task: Task }) {
  return (
    <article className="rounded-[var(--radius-sm)] border border-[var(--line)] bg-[var(--panel-strong)] p-3 text-sm transition-colors hover:border-[var(--line-strong)]">
      <div className="mb-2 flex items-start justify-between gap-3">
        <h3 className="font-medium leading-snug">{task.title}</h3>
        <span className="text-xs text-[var(--muted)] num">#{task.id}</span>
      </div>
      <div className="flex flex-wrap items-center gap-1.5 text-xs text-[var(--muted)]">
        <span className="truncate">{task.projectName}</span>
        {task.complexity ? <span className="badge">C{task.complexity}</span> : null}
        {task.dependsOn.length ? <span className="badge">deps {task.dependsOn.join(", ")}</span> : null}
      </div>
    </article>
  );
}