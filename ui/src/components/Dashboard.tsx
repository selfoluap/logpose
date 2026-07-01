import type { Project, StatusSummary } from "../types";

type Props = {
  status: StatusSummary | null;
  projects: Project[];
};

function total(counts: Record<string, number>) {
  return Object.values(counts).reduce((sum, count) => sum + count, 0);
}

export function Dashboard({ status, projects }: Props) {
  if (!status) {
    return <div className="panel p-4 text-sm text-[var(--muted)]">Loading...</div>;
  }

  return (
    <section className="grid gap-4 lg:grid-cols-4">
      <Stat label="Projects" value={status.projects} />
      <Stat label="Tasks" value={total(status.tasks)} />
      <Stat label="Ideas" value={total(status.ideas)} />
      <Stat label="Brain Ideas" value={total(status.brain)} />
      <div className="panel p-4 lg:col-span-2">
        <h2 className="mb-3 text-sm font-medium">Tasks by status</h2>
        <Breakdown counts={status.tasks} />
      </div>
      <div className="panel p-4">
        <h2 className="mb-3 text-sm font-medium">Bugs</h2>
        <div className="text-2xl font-semibold">{total(status.bugs)}</div>
        <Breakdown counts={status.bugs} />
      </div>
      <div className="panel p-4">
        <h2 className="mb-3 text-sm font-medium">Projects</h2>
        <div className="space-y-2 text-sm">
          {projects.slice(0, 6).map((project) => (
            <div key={project.id} className="flex justify-between gap-3 text-[var(--muted)]">
              <span className="truncate text-[var(--text)]">{project.name}</span>
              <span>{project.taskCount} tasks</span>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div className="panel p-4">
      <div className="text-sm text-[var(--muted)]">{label}</div>
      <div className="mt-2 text-3xl font-semibold">{value}</div>
    </div>
  );
}

function Breakdown({ counts }: { counts: Record<string, number> }) {
  return (
    <div className="space-y-2 text-sm">
      {Object.entries(counts).map(([status, count]) => (
        <div key={status} className="flex items-center justify-between gap-3">
          <span className="flex items-center gap-2 capitalize text-[var(--muted)]">
            <span className="status-dot" />
            {status.replaceAll("_", " ")}
          </span>
          <span>{count}</span>
        </div>
      ))}
    </div>
  );
}
