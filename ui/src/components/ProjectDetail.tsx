import type { ActivityBucket, Project, Task, TaskStatus } from "../types";

const statuses: TaskStatus[] = ["pending", "planned", "in_progress", "blocked", "done"];

type Props = {
  project: Project;
  tasks: Task[];
  activity: ActivityBucket[];
  onBack: () => void;
};

export function ProjectDetail({ project, tasks, activity, onBack }: Props) {
  const doneCount = tasks.filter((task) => task.status === "done").length;

  return (
    <section className="space-y-4">
      <button type="button" onClick={onBack} className="text-sm text-[var(--muted)] hover:text-white">
        Back to work history
      </button>

      <div className="panel p-4">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <h2 className="text-xl font-semibold">{project.name}</h2>
            <p className="mt-1 text-sm text-[var(--muted)]">{project.path}</p>
          </div>
          <span className="badge">{project.agentsMdPath ? "AGENTS.md" : "No AGENTS.md"}</span>
        </div>
      </div>

      <div className="grid gap-3 md:grid-cols-4">
        <Stat label="Tasks" value={tasks.length} />
        <Stat label="Done" value={doneCount} />
        <Stat label="Ideas" value={project.ideaCount} />
        <Stat label="Activity Days" value={activity.length} />
      </div>

      <ProjectActivityChart activity={activity} />

      <div className="panel p-4">
        <h3 className="mb-3 text-sm font-medium">Task overview</h3>
        <div className="grid gap-2 md:grid-cols-5">
          {statuses.map((status) => (
            <div key={status} className="rounded-[var(--radius)] border border-[var(--line)] bg-black/10 p-3">
              <div className="text-xs capitalize text-[var(--muted)]">{status.replaceAll("_", " ")}</div>
              <div className="mt-1 text-2xl font-semibold">{tasks.filter((task) => task.status === status).length}</div>
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
      <div className="text-xs text-[var(--muted)]">{label}</div>
      <div className="mt-2 text-2xl font-semibold">{value}</div>
    </div>
  );
}

function ProjectActivityChart({ activity }: { activity: ActivityBucket[] }) {
  const max = Math.max(...activity.map((bucket) => bucket.count), 1);
  const points = activity.map((bucket, index) => {
    const x = activity.length === 1 ? 50 : (index / (activity.length - 1)) * 100;
    const y = 90 - (bucket.count / max) * 70;
    return `${x},${y}`;
  });

  return (
    <div className="panel p-4">
      <div className="mb-4">
        <h3 className="text-sm font-medium">Project activity</h3>
        <p className="text-xs text-[var(--muted)]">Completed tasks over time</p>
      </div>
      {activity.length === 0 ? (
        <div className="text-sm text-[var(--muted)]">No completed work yet.</div>
      ) : (
        <svg viewBox="0 0 100 100" className="h-56 w-full overflow-visible">
          <polyline fill="none" stroke="var(--online)" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" points={points.join(" ")} />
          {activity.map((bucket, index) => {
            const [x, y] = points[index].split(",");
            return <circle key={bucket.date} cx={x} cy={y} r="2.4" fill="var(--online)" />;
          })}
        </svg>
      )}
    </div>
  );
}
