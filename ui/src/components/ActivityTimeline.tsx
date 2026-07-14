import type { CSSProperties } from "react";
import type { ActivityBucket } from "../types";

type Props = {
  buckets: ActivityBucket[];
};

function duration(seconds: number | null) {
  if (seconds === null) return "duration unknown";
  if (seconds < 60) return `${seconds}s`;
  return `${Math.round(seconds / 60)}m`;
}

function taskLabel(count: number) {
  return `${count} task${count === 1 ? "" : "s"}`;
}

type ActivityGraphStyle = CSSProperties & { "--day-count": number };

export function ActivityTimeline({ buckets }: Props) {
  const dates = [...new Set(buckets.map((bucket) => bucket.date))];
  const projects = [...new Set(buckets.map((bucket) => bucket.projectName))].sort();
  const bucketFor = (date: string, project: string) => buckets.find((bucket) => bucket.date === date && bucket.projectName === project);
  const maxCount = Math.max(...buckets.map((bucket) => bucket.count), 1);
  const graphStyle = { "--day-count": dates.length } as ActivityGraphStyle;

  return (
    <div className="panel p-4 lg:col-span-4">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-sm font-medium">Completed task activity</h2>
          <p className="text-xs text-[var(--muted)]">Uses build metadata when available, then falls back to the task record.</p>
        </div>
      </div>
      {buckets.length === 0 ? (
        <div className="text-sm text-[var(--muted)]">No completed tasks yet.</div>
      ) : (
        <>
          <div className="mb-5 overflow-x-auto">
            <h3 className="mb-3 text-xs font-medium uppercase tracking-wide text-[var(--muted)]">Activity graph</h3>
            <div className="min-w-max space-y-3">
              {projects.map((project) => (
                <div key={project} className="grid grid-cols-[7rem_repeat(var(--day-count),2.75rem)] items-end gap-2" style={graphStyle}>
                  <div className="truncate pb-6 text-xs text-[var(--muted)]">{project}</div>
                  {dates.map((date) => {
                    const count = bucketFor(date, project)?.count ?? 0;
                    const label = `${project} completed ${taskLabel(count)} on ${date}`;

                    return (
                      <div key={date} className="flex flex-col items-center gap-1">
                        <div className="flex h-20 w-8 items-end rounded border border-[var(--line)] bg-black/10 p-1" aria-label={label} title={label}>
                          <div className="w-full rounded-sm bg-[var(--accent)]" style={{ height: count ? `${Math.max((count / maxCount) * 100, 12)}%` : 0 }} />
                        </div>
                        <span className="text-[0.65rem] text-[var(--muted)]">{count}</span>
                      </div>
                    );
                  })}
                </div>
              ))}
              <div className="grid grid-cols-[7rem_repeat(var(--day-count),2.75rem)] gap-2" style={graphStyle}>
                <div />
                {dates.map((date) => (
                  <div key={date} className="-rotate-45 whitespace-nowrap text-[0.65rem] text-[var(--muted)]">{date.slice(5)}</div>
                ))}
              </div>
            </div>
          </div>
          <div className="overflow-x-auto">
            <table className="min-w-full text-left text-sm">
              <thead className="text-xs uppercase tracking-wide text-[var(--muted)]">
                <tr>
                  <th className="border-b border-[var(--line)] py-2 pr-4 font-medium">Date</th>
                  {projects.map((project) => (
                    <th key={project} className="border-b border-[var(--line)] px-3 py-2 font-medium">{project}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {dates.map((date) => (
                  <tr key={date} className="align-top">
                    <th className="whitespace-nowrap border-b border-[var(--line)] py-3 pr-4 font-medium">{date}</th>
                    {projects.map((project) => {
                      const bucket = bucketFor(date, project);

                      return (
                        <td key={project} className="min-w-48 border-b border-[var(--line)] px-3 py-3">
                          {bucket ? (
                            <details>
                              <summary className="cursor-pointer text-[var(--text)]">{taskLabel(bucket.count)}</summary>
                              <div className="mt-3 space-y-2 text-xs text-[var(--muted)]">
                                {bucket.tasks.map((task) => (
                                  <div key={task.id} className="flex justify-between gap-3">
                                    <span className="text-[var(--text)]">#{task.id} {task.title}</span>
                                    <span>{duration(task.durationSeconds)}</span>
                                  </div>
                                ))}
                              </div>
                            </details>
                          ) : (
                            <span className="text-[var(--muted)]">-</span>
                          )}
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  );
}
