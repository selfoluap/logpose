import type { ActivityBucket } from "../types";

type Props = {
  buckets: ActivityBucket[];
};

const colors = ["#60a5fa", "#34d399", "#f59e0b", "#f472b6", "#a78bfa", "#fb7185"];

function duration(seconds: number | null) {
  if (seconds === null) return "duration unknown";
  if (seconds < 60) return `${seconds}s`;
  return `${Math.round(seconds / 60)}m`;
}

export function ActivityTimeline({ buckets }: Props) {
  const dates = [...new Set(buckets.map((bucket) => bucket.date))];
  const projects = [...new Set(buckets.map((bucket) => bucket.projectName))];
  const max = Math.max(1, ...buckets.map((bucket) => bucket.count));
  const width = Math.max(280, dates.length * 72);
  const height = 180;
  const left = 36;
  const bottom = 28;
  const plotWidth = width - left - 16;
  const plotHeight = height - bottom - 14;
  const ticks = Array.from({ length: Math.min(max, 5) }, (_, index) => Math.ceil(((index + 1) * max) / Math.min(max, 5)));

  const x = (date: string) => left + (dates.length === 1 ? plotWidth / 2 : (dates.indexOf(date) / (dates.length - 1)) * plotWidth);
  const y = (count: number) => 14 + plotHeight - (count / max) * plotHeight;

  return (
    <div className="panel p-4 lg:col-span-4">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-sm font-medium">Completed task activity</h2>
          <p className="text-xs text-[var(--muted)]">Buckets use task done date from the current task record.</p>
        </div>
        <div className="flex flex-wrap gap-2 text-xs text-[var(--muted)]">
          {projects.map((project, index) => (
            <span key={project} className="inline-flex items-center gap-1">
              <span className="h-2 w-2 rounded-full" style={{ background: colors[index % colors.length] }} />
              {project}
            </span>
          ))}
        </div>
      </div>
      {buckets.length === 0 ? (
        <div className="text-sm text-[var(--muted)]">No completed tasks yet.</div>
      ) : (
        <>
          <div className="overflow-x-auto">
            <svg role="img" aria-label="Completed task counts per day by project" width={width} height={height} className="min-w-full">
              {ticks.map((count) => (
                <g key={count}>
                  <line x1={left} x2={width - 16} y1={y(count)} y2={y(count)} stroke="rgba(255,255,255,.08)" />
                  <text x={8} y={y(count) + 4} fill="var(--muted)" fontSize="10">{count}</text>
                </g>
              ))}
              {projects.map((project, index) => {
                const points = dates.map((date) => {
                  const count = buckets.find((bucket) => bucket.date === date && bucket.projectName === project)?.count ?? 0;
                  return `${x(date)},${y(count)}`;
                });

                return <polyline key={project} points={points.join(" ")} fill="none" stroke={colors[index % colors.length]} strokeWidth="2.5" />;
              })}
              {buckets.map((bucket) => (
                <circle key={`${bucket.date}:${bucket.projectId}`} cx={x(bucket.date)} cy={y(bucket.count)} r="4" fill="var(--text)">
                  <title>{`${bucket.projectName} ${bucket.date}: ${bucket.count} task${bucket.count === 1 ? "" : "s"}`}</title>
                </circle>
              ))}
              {dates.map((date) => (
                <text key={date} x={x(date)} y={height - 8} textAnchor="middle" fill="var(--muted)" fontSize="10">{date.slice(5)}</text>
              ))}
            </svg>
          </div>
          <div className="mt-4 grid gap-2 md:grid-cols-2 xl:grid-cols-3">
            {buckets.map((bucket) => (
              <details key={`${bucket.date}:${bucket.projectId}`} className="rounded-md border border-[var(--line)] p-3 text-sm">
                <summary className="cursor-pointer text-[var(--text)]">{bucket.date} / {bucket.projectName} / {bucket.count} done</summary>
                <div className="mt-3 space-y-2 text-xs text-[var(--muted)]">
                  {bucket.tasks.map((task) => (
                    <div key={task.id} className="flex justify-between gap-3">
                      <span className="text-[var(--text)]">#{task.id} {task.title}</span>
                      <span>{duration(task.durationSeconds)}</span>
                    </div>
                  ))}
                </div>
              </details>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
