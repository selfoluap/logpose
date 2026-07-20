import { useState } from "react";
import type { BrainIdea } from "../types";

const statusColor: Record<BrainIdea["status"], string> = {
  new: "var(--color-accent)",
  exploring: "var(--color-warn)",
  done: "var(--color-online)",
  abandoned: "var(--color-ink-muted)",
};

export function BrainList({ brain }: { brain: BrainIdea[] }) {
  const [tag, setTag] = useState("all");
  const tags = [...new Set(brain.map((idea) => idea.tag).filter((value): value is string => Boolean(value)))];
  const filtered = tag === "all" ? brain : brain.filter((idea) => idea.tag === tag);

  return (
    <section>
      <div className="mb-4 flex justify-end">
        <select value={tag} onChange={(event) => setTag(event.target.value)} className="panel px-3 py-2 text-sm">
          <option value="all">All tags</option>
          {tags.map((option) => (
            <option key={option} value={option}>
              {option}
            </option>
          ))}
        </select>
      </div>
      <div className="grid gap-3 lg:grid-cols-2">
        {filtered.map((idea) => (
          <article key={idea.id} className="panel p-4">
            <div className="mb-2 flex items-center justify-between gap-3">
              <h2 className="text-sm font-medium">{idea.title}</h2>
              <span className="inline-flex items-center gap-1.5 text-xs text-[var(--muted)]">
                <span className="status-dot" style={{ background: statusColor[idea.status] }} />
                {idea.status}
              </span>
            </div>
            <p className="text-sm text-[var(--muted)]">{idea.description ?? "No description"}</p>
            {idea.tag ? <div className="mt-3 inline-flex badge">{idea.tag}</div> : null}
          </article>
        ))}
      </div>
    </section>
  );
}