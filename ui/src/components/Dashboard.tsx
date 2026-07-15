import type { ActivityBucket, Project, StatusSummary } from "../types";

type Props = {
  status: StatusSummary | null;
  projects: Project[];
  activity: ActivityBucket[];
  onProjectSelect: (projectId: number) => void;
};

function total(counts: Record<string, number>) {
  return Object.values(counts).reduce((sum, count) => sum + count, 0);
}

export function Dashboard({ status, projects, activity, onProjectSelect }: Props) {
  if (!status) {
    return <div className="panel p-4 text-sm text-[var(--muted)]">Loading…</div>;
  }

  const activityMax = Math.max(...projects.map((project) => projectActivity(project, activity).count), 1);

  return (
    <section className="space-y-4">
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Stat label="Projects" value={status.projects} emphasis />
        <Stat label="Tasks" value={total(status.tasks)} />
        <Stat label="Ideas" value={total(status.ideas)} />
        <Stat label="Brain Ideas" value={total(status.brain)} />
      </div>

      <div className="panel overflow-hidden">
        <div className="flex items-baseline justify-between border-b border-[var(--line)] px-4 py-3">
          <div>
            <h2 className="text-sm font-medium">Work history</h2>
            <p className="text-xs text-[var(--muted)]">Completed work by project</p>
          </div>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[44rem] text-left text-sm">
            <thead className="text-xs uppercase tracking-wide text-[var(--muted)]">
              <tr className="border-b border-[var(--line)]">
                <th className="px-4 py-2.5 font-medium">Project</th>
                <th className="px-4 py-2.5 font-medium">Tasks</th>
                <th className="px-4 py-2.5 font-medium">Ideas</th>
                <th className="px-4 py-2.5 font-medium">Activity</th>
                <th className="px-4 py-2.5 font-medium">Last work</th>
              </tr>
            </thead>
            <tbody>
              {projects.map((project) => {
                const stats = projectActivity(project, activity);
                const width = stats.count ? `${Math.max((stats.count / activityMax) * 100, 8)}%` : 0;

                return (
                  <tr
                    key={project.id}
                    tabIndex={0}
                    role="button"
                    onClick={() => onProjectSelect(project.id)}
                    onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); onProjectSelect(project.id); } }}
                    className="cursor-pointer border-b border-[var(--line)] transition-colors last:border-b-0 hover:bg-white/[0.035] focus-visible:bg-white/[0.05]"
                  >
                    <td className="px-4 py-3 font-medium">{project.name}</td>
                    <td className="px-4 py-3 text-[var(--muted)] num">{project.taskCount}</td>
                    <td className="px-4 py-3 text-[var(--muted)] num">{project.ideaCount}</td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-3">
                        <span className="w-6 text-right font-semibold num">{stats.count}</span>
                        <div className="h-1.5 w-28 rounded-full bg-white/[0.06]">
                          <div className="h-1.5 rounded-full bg-[var(--online)]" style={{ width }} />
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-[var(--muted)] num">{stats.last}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      <div className="grid gap-3 lg:grid-cols-3">
        <div className="panel p-4 lg:col-span-2">
          <h2 className="mb-3 text-sm font-medium">Tasks by status</h2>
          <Breakdown counts={status.tasks} />
        </div>
        <div className="panel p-4">
          <h2 className="mb-3 text-sm font-medium">Bugs</h2>
          <div className="text-2xl font-semibold num">{total(status.bugs)}</div>
          <div className="mt-3">
            <Breakdown counts={status.bugs} />
          </div>
        </div>
      </div>
    </section>
  );
}

function projectActivity(project: Project, activity: ActivityBucket[]) {
  const buckets = activity.filter((bucket) => bucket.projectId === project.id);
  const count = buckets.reduce((sum, bucket) => sum + bucket.count, 0);
  const last = buckets.at(-1)?.date ?? "No activity";
  return { count, last };
}

function Stat({ label, value, emphasis = false }: { label: string; value: number; emphasis?: boolean }) {
  return (
    <div className={`panel p-4${emphasis ? " stat-emphasis" : ""}`}>
      <div className="text-xs uppercase tracking-wide text-[var(--muted)]">{label}</div>
      <div className="mt-2 text-2xl font-semibold num">{value}</div>
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
          <span className="num">{count}</span>
        </div>
      ))}
    </div>
  );
}