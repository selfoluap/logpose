import type { Task } from "../types";

export function TaskCard({ task }: { task: Task }) {
  return (
    <article className="rounded-[var(--radius)] border border-[var(--line)] bg-[var(--panel-strong)] p-3 text-sm transition-colors hover:border-white/20">
      <div className="mb-2 flex items-start justify-between gap-3">
        <h3 className="font-medium leading-snug">{task.title}</h3>
        <span className="text-xs text-[var(--muted)]">#{task.id}</span>
      </div>
      <div className="flex flex-wrap items-center gap-2 text-xs text-[var(--muted)]">
        <span>{task.projectName}</span>
        {task.complexity ? <span className="badge">C{task.complexity}</span> : null}
        {task.dependsOn.length ? <span className="badge">deps {task.dependsOn.join(", ")}</span> : null}
      </div>
    </article>
  );
}
