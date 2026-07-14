import { useState } from "react";
import type { ActivityBucket, Project, Task, TaskStatus } from "../types";

const statuses: TaskStatus[] = ["pending", "planned", "in_progress", "blocked", "done"];
const activityRanges = [
  { label: "1 minute", value: "1m", ms: 60 * 1000, bins: 12 },
  { label: "1 hour", value: "1h", ms: 60 * 60 * 1000, bins: 24 },
  { label: "12 hours", value: "12h", ms: 12 * 60 * 60 * 1000, bins: 24 },
  { label: "24 hours", value: "24h", ms: 24 * 60 * 60 * 1000, bins: 24 },
  { label: "1 week", value: "1w", ms: 7 * 24 * 60 * 60 * 1000, bins: 28 },
  { label: "30 days", value: "30d", ms: 30 * 24 * 60 * 60 * 1000, bins: 30 },
] as const;

type ActivityRangeValue = (typeof activityRanges)[number]["value"];

type Props = {
  project: Project;
  tasks: Task[];
  activity: ActivityBucket[];
  onBack: () => void;
};

export function ProjectDetail({ project, tasks, activity, onBack }: Props) {
  const [activityRange, setActivityRange] = useState<ActivityRangeValue>("24h");
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

      <ProjectActivityChart activity={activity} range={activityRange} onRangeChange={setActivityRange} />

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

function ProjectActivityChart({
  activity,
  range,
  onRangeChange,
}: {
  activity: ActivityBucket[];
  range: ActivityRangeValue;
  onRangeChange: (range: ActivityRangeValue) => void;
}) {
  const selectedRange = activityRanges.find((item) => item.value === range) ?? activityRanges[3];
  const now = Date.now();
  const start = now - selectedRange.ms;
  const binMs = selectedRange.ms / selectedRange.bins;
  const bins = Array.from({ length: selectedRange.bins }, (_, index) => ({
    start: start + index * binMs,
    end: start + (index + 1) * binMs,
    count: 0,
  }));

  for (const bucket of activity) {
    for (const task of bucket.tasks) {
      const doneAt = Date.parse(task.doneAt);
      if (Number.isNaN(doneAt) || doneAt < start || doneAt > now) continue;

      bins[Math.min(Math.floor((doneAt - start) / binMs), bins.length - 1)].count += 1;
    }
  }

  const total = bins.reduce((sum, bin) => sum + bin.count, 0);
  const max = Math.max(...bins.map((bin) => bin.count), 1);

  return (
    <div className="panel p-4">
      <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
        <div>
          <h3 className="text-sm font-medium">Project activity</h3>
          <p className="text-xs text-[var(--muted)]">
            {total} completed task{total === 1 ? "" : "s"} in the last {selectedRange.label}
          </p>
        </div>
        <select aria-label="Project activity range" className="range-select" value={range} onChange={(event) => onRangeChange(event.target.value as ActivityRangeValue)}>
          {activityRanges.map((item) => (
            <option key={item.value} value={item.value}>{item.label}</option>
          ))}
        </select>
      </div>
      {total === 0 ? (
        <div className="text-sm text-[var(--muted)]">No completed work in this range.</div>
      ) : (
        <div className="space-y-2">
          <div className="flex h-48 items-end gap-1 rounded-[var(--radius)] border border-[var(--line)] bg-black/10 p-3">
            {bins.map((bin) => (
              <div
                key={bin.start}
                className="min-w-0 flex-1 rounded-t bg-[var(--online)]/90"
                style={{ height: bin.count ? `${Math.max((bin.count / max) * 100, 8)}%` : 2 }}
                title={`${bin.count} task${bin.count === 1 ? "" : "s"} from ${formatRangeTime(bin.start)} to ${formatRangeTime(bin.end)}`}
              />
            ))}
          </div>
          <div className="flex justify-between text-[0.65rem] text-[var(--muted)]">
            <span>{formatRangeTime(start)}</span>
            <span>{formatRangeTime(now)}</span>
          </div>
        </div>
      )}
    </div>
  );
}

function formatRangeTime(ms: number) {
  return new Date(ms).toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}
