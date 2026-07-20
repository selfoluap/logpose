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
      <div className="mb-3 flex flex-wrap items-center justify-between gap-3 border-b border-[var(--line)] pb-3">
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
                <div key={project} className="grid items-center gap-2" style={{ ...graphStyle, gridTemplateColumns: `7rem repeat(${dates.length}, 8rem)` }}>
                  <div className="truncate text-xs text-[var(--muted)]">{project}</div>
                  {dates.map((date) => {
                    const count = bucketFor(date, project)?.count ?? 0;
                    const label = `${project} completed ${taskLabel(count)} on ${date}`;

                    return (
                      <div key={date} className="flex items-center gap-2" aria-label={label} title={label}>
                        <span className="w-8 text-right font-bold num text-[var(--text)]">{count}</span>
                        <div className="h-4 w-20 rounded bg-black/20">
                          <div className="h-4 rounded bg-[var(--online)]" style={{ width: count ? `${Math.max((count / maxCount) * 100, 12)}%` : 0 }} />
                        </div>
                      </div>
                    );
                  })}
                </div>
              ))}
              <div className="grid gap-2" style={{ ...graphStyle, gridTemplateColumns: `7rem repeat(${dates.length}, 8rem)` }}>
                <div />
                {dates.map((date) => (
                  <div key={date} className="text-center font-mono text-[0.65rem] text-[var(--muted)]" style={{ fontFamily: "var(--font-mono)" }}>{date.slice(5)}</div>
                ))}
              </div>
            </div>
          </div>
          <div className="mx-auto w-full overflow-x-auto">
            <table className="w-full min-w-full text-left text-sm">
              <thead className="text-xs uppercase tracking-wide text-[var(--muted)]">
                <tr>
                  <th className="border-b border-[var(--line)] py-2 pr-4 font-medium">Date</th>
                  {projects.map((project) => (
                    <th key={project} className="border-b border-[var(--line)] px-3 py-3 text-center text-lg font-semibold normal-case tracking-tight text-[var(--text)]">{project}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {dates.map((date) => (
                  <tr key={date} className="align-top">
                    <th className="whitespace-nowrap border-b border-[var(--line)] py-3 pr-4 font-mono text-left font-medium text-[var(--muted)]" style={{ fontFamily: "var(--font-mono)" }}>{date}</th>
                    {projects.map((project) => {
                      const bucket = bucketFor(date, project);

                      return (
                        <td key={project} className="min-w-48 border-b border-[var(--line)] px-3 py-3">
                          {bucket ? (
                            <details>
                              <summary className="cursor-pointer font-medium text-[var(--text)]">{taskLabel(bucket.count)}</summary>
                              <div className="mt-3 space-y-2 text-xs text-[var(--muted)]">
                                {bucket.tasks.map((task) => (
                                  <div key={task.id} className="flex justify-between gap-3">
                                    <span className="text-[var(--text)]"><span className="num">#{task.id}</span> {task.title}</span>
                                    <span className="num">{duration(task.durationSeconds)}</span>
                                  </div>
                                ))}
                              </div>
                            </details>
                          ) : (
                            <span className="text-[var(--muted)]">—</span>
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