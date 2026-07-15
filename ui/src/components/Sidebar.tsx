import type { LucideIcon } from "lucide-react";
import type { View } from "../App";

type Props = {
  views: readonly { id: View; label: string; icon: LucideIcon }[];
  active: View;
  onChange: (view: View) => void;
};

export function Sidebar({ views, active, onChange }: Props) {
  return (
    <aside className="border-b border-[var(--line)] bg-[var(--color-paper)] md:min-h-screen md:border-b-0 md:border-r">
      <div className="flex min-h-[3.25rem] flex-col md:h-full">
        <div className="flex items-center gap-2 px-4 py-3 md:px-3 md:py-4">
          <span className="brand-dot" aria-hidden="true" />
          <span
            className="text-sm font-semibold tracking-tight text-[var(--text)]"
            style={{ fontFamily: "var(--font-mono)", letterSpacing: "-0.02em" }}
          >
            logpose
          </span>
        </div>
        <nav className="flex gap-1 px-2 pb-2 md:flex-col md:px-3 md:pb-3">
          {views.map((view) => {
            const Icon = view.icon;
            const selected = view.id === active;

            return (
              <button
                key={view.id}
                type="button"
                onClick={() => onChange(view.id)}
                className={`group relative flex flex-1 items-center justify-center gap-2 rounded-[var(--radius-sm)] px-3 py-2 text-[0.8125rem] transition-colors md:flex-none md:justify-start ${
                  selected
                    ? "bg-white/[0.04] text-[var(--text)]"
                    : "text-[var(--muted)] hover:bg-white/[0.03] hover:text-[var(--text)]"
                }`}
              >
                <span
                  aria-hidden="true"
                  className={`absolute left-0 top-1/2 hidden h-4 w-0.5 -translate-y-1/2 rounded-full bg-[var(--accent)] transition-opacity md:block ${selected ? "opacity-100" : "opacity-0"}`}
                />
                <Icon size={14} className={selected ? "text-[var(--accent)]" : ""} strokeWidth={2} />
                <span>{view.label}</span>
              </button>
            );
          })}
        </nav>
        <div className="mt-auto hidden items-center gap-2 border-t border-[var(--line)] px-3 py-3 text-[0.625rem] text-[var(--muted)] md:flex">
          <span className="brand-dot" aria-hidden="true" style={{ background: "var(--color-online)" }} />
          <span
            className="uppercase tracking-[0.14em]"
            style={{ fontFamily: "var(--font-mono)" }}
          >
            local
          </span>
        </div>
      </div>
    </aside>
  );
}