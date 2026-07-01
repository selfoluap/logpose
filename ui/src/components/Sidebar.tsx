import type { LucideIcon } from "lucide-react";
import type { View } from "../App";

type Props = {
  views: readonly { id: View; label: string; icon: LucideIcon }[];
  active: View;
  onChange: (view: View) => void;
};

export function Sidebar({ views, active, onChange }: Props) {
  return (
    <aside className="border-b border-[var(--line)] bg-[rgba(13,15,21,0.72)] p-3 md:min-h-screen md:border-b-0 md:border-r">
      <div className="mb-4 px-2 text-sm font-semibold text-[var(--text)]">logpose</div>
      <nav className="flex gap-2 md:flex-col">
        {views.map((view) => {
          const Icon = view.icon;
          const selected = view.id === active;

          return (
            <button
              key={view.id}
              type="button"
              onClick={() => onChange(view.id)}
              className={`flex items-center gap-2 rounded-[var(--radius)] px-3 py-2 text-sm transition-colors ${
                selected ? "bg-[var(--accent)] text-white" : "text-[var(--muted)] hover:bg-white/5 hover:text-white"
              }`}
            >
              <Icon size={16} />
              {view.label}
            </button>
          );
        })}
      </nav>
    </aside>
  );
}
