import type { Idea } from "../types";

const OPEN_IDEA_STATUSES: Set<Idea["status"]> = new Set(["new", "refined"]);

const statusColor: Record<Idea["status"], string> = {
  new: "var(--color-accent)",
  refined: "var(--color-warn)",
  converted: "var(--color-ink-muted)",
};

export function IdeasList({ ideas }: { ideas: Idea[] }) {
  const open = ideas.filter((i) => OPEN_IDEA_STATUSES.has(i.status));
  const grouped = open.reduce<Record<string, Idea[]>>((groups, idea) => {
    groups[idea.projectName] ??= [];
    groups[idea.projectName].push(idea);
    return groups;
  }, {});

  return (
    <section className="space-y-4">
      {Object.entries(grouped).map(([projectName, projectIdeas]) => (
        <div key={projectName} className="panel p-4">
          <h2 className="mb-3 text-xs font-medium uppercase tracking-wide text-[var(--muted)]">{projectName}</h2>
          <div className="space-y-2">
            {projectIdeas.map((idea) => (
              <article key={idea.id} className="rounded-[var(--radius-sm)] border border-[var(--line)] bg-[var(--panel-strong)] p-3">
                <div className="mb-1.5 flex items-center justify-between gap-3">
                  <h3 className="text-sm font-medium">{idea.title}</h3>
                  <span className="inline-flex items-center gap-1.5 text-xs text-[var(--muted)]">
                    <span className="status-dot" style={{ background: statusColor[idea.status] }} />
                    {idea.status}
                  </span>
                </div>
                <p className="text-sm text-[var(--muted)]">{idea.refinedDescription ?? idea.description ?? "No description"}</p>
                {idea.complexity ? <div className="mt-2 inline-flex badge">C{idea.complexity}</div> : null}
              </article>
            ))}
          </div>
        </div>
      ))}
    </section>
  );
}