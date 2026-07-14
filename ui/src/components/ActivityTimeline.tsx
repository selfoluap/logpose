import type { ActivityBucket } from "../types";

type Props = {
  buckets: ActivityBucket[];
};

function duration(seconds: number | null) {
  if (seconds === null) return "duration unknown";
  if (seconds < 60) return `${seconds}s`;
  return `${Math.round(seconds / 60)}m`;
}

export function ActivityTimeline({ buckets }: Props) {
  const dates = [...new Set(buckets.map((bucket) => bucket.date))];
  const projects = [...new Set(buckets.map((bucket) => bucket.projectName))].sort();
  const bucketFor = (date: string, project: string) => buckets.find((bucket) => bucket.date === date && bucket.projectName === project);

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
                              <summary className="cursor-pointer text-[var(--text)]">{bucket.count} task{bucket.count === 1 ? "" : "s"}</summary>
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
