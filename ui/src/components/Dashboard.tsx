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
    return <div className="panel p-4 text-sm text-[var(--muted)]">Loading...</div>;
  }

  const activityMax = Math.max(...projects.map((project) => projectActivity(project, activity).count), 1);

  return (
    <section className="grid gap-4 lg:grid-cols-4">
      <Stat label="Projects" value={status.projects} />
      <Stat label="Tasks" value={total(status.tasks)} />
      <Stat label="Ideas" value={total(status.ideas)} />
      <Stat label="Brain Ideas" value={total(status.brain)} />
      <div className="panel overflow-hidden lg:col-span-4">
        <div className="border-b border-[var(--line)] p-4">
          <h2 className="text-sm font-medium">Work history</h2>
          <p className="text-xs text-[var(--muted)]">Completed work by project</p>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[44rem] text-left text-sm">
            <thead className="text-xs uppercase tracking-wide text-[var(--muted)]">
              <tr>
                <th className="px-4 py-3 font-medium">Project</th>
                <th className="px-4 py-3 font-medium">Tasks</th>
                <th className="px-4 py-3 font-medium">Ideas</th>
                <th className="px-4 py-3 font-medium">Activity</th>
                <th className="px-4 py-3 font-medium">Last work</th>
              </tr>
            </thead>
            <tbody>
              {projects.map((project) => {
                const stats = projectActivity(project, activity);
                const width = stats.count ? `${Math.max((stats.count / activityMax) * 100, 8)}%` : 0;

                return (
                  <tr key={project.id} onClick={() => onProjectSelect(project.id)} className="cursor-pointer border-t border-[var(--line)] transition-colors hover:bg-white/[0.04]">
                    <td className="px-4 py-3 font-medium">{project.name}</td>
                    <td className="px-4 py-3 text-[var(--muted)]">{project.taskCount}</td>
                    <td className="px-4 py-3 text-[var(--muted)]">{project.ideaCount}</td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-3">
                        <span className="w-8 text-right font-semibold">{stats.count}</span>
                        <div className="h-3 w-32 rounded-full bg-black/20">
                          <div className="h-3 rounded-full bg-[var(--online)]" style={{ width }} />
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-[var(--muted)]">{stats.last}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
      <div className="panel p-4 lg:col-span-2">
        <h2 className="mb-3 text-sm font-medium">Tasks by status</h2>
        <Breakdown counts={status.tasks} />
      </div>
      <div className="panel p-4">
        <h2 className="mb-3 text-sm font-medium">Bugs</h2>
        <div className="text-2xl font-semibold">{total(status.bugs)}</div>
        <Breakdown counts={status.bugs} />
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
