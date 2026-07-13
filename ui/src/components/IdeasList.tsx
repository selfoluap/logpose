import type { Idea } from "../types";

const colors: Record<Idea["status"], string> = {
  new: "text-blue-300",
  refined: "text-amber-300",
  converted: "text-slate-400"
};

const OPEN_IDEA_STATUSES: Set<Idea["status"]> = new Set(["new", "refined"]);

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
          <h2 className="mb-3 text-sm font-medium">{projectName}</h2>
          <div className="space-y-2">
            {projectIdeas.map((idea) => (
              <article key={idea.id} className="rounded-[var(--radius)] border border-[var(--line)] bg-[var(--panel-strong)] p-3">
                <div className="mb-2 flex items-center justify-between gap-3">
                  <h3 className="text-sm font-medium">{idea.title}</h3>
                  <span className={`badge ${colors[idea.status]}`}>{idea.status}</span>
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
