import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { BrainList } from "./BrainList";
import { Dashboard } from "./Dashboard";
import { IdeasList } from "./IdeasList";
import { KanbanBoard } from "./KanbanBoard";

describe("dashboard views", () => {
  it("renders dashboard totals", () => {
    const html = renderToStaticMarkup(
      <Dashboard
        status={{ projects: 2, tasks: { pending: 1, done: 2 }, ideas: { new: 3 }, brain: { exploring: 4 }, bugs: { error: 1 } }}
        projects={[{ id: 1, name: "alpha", path: "/tmp/a", agentsMdPath: null, createdAt: "", updatedAt: "", taskCount: 2, ideaCount: 1 }]}
        activity={[{ date: "2026-01-02", projectId: 1, projectName: "alpha", count: 1, tasks: [{ id: 7, title: "Done task", doneAt: "2026-01-02T00:00:00.000Z", durationSeconds: 120 }] }]}
      />
    );

    expect(html).toContain("Projects");
    expect(html).toContain("Brain Ideas");
    expect(html).toContain("Completed task activity");
    expect(html).toContain("#7 Done task");
    expect(html).toContain("2m");
    expect(html).toContain("alpha");
  });

  it("renders kanban columns and task details", () => {
    const html = renderToStaticMarkup(
      <KanbanBoard
        projects={[{ id: 1, name: "alpha", path: "/tmp/a", agentsMdPath: null, createdAt: "", updatedAt: "", taskCount: 1, ideaCount: 0 }]}
        tasks={[{ id: 1, projectId: 1, projectName: "alpha", ideaId: null, title: "Ship UI", description: null, status: "pending", createdAt: "", updatedAt: "", complexity: 2, dependsOn: [9] }]}
      />
    );

    expect(html).toContain("Pending");
    expect(html).toContain("Ship UI");
    expect(html).toContain("deps 9");
  });

  it("renders grouped ideas and brain tags", () => {
    const ideasHtml = renderToStaticMarkup(
      <IdeasList ideas={[{ id: 1, projectId: 1, projectName: "alpha", title: "Idea", description: "desc", refinedDescription: null, status: "new", createdAt: "", updatedAt: "", complexity: 3 }]} />
    );
    const brainHtml = renderToStaticMarkup(
      <BrainList brain={[{ id: 1, title: "Brain", description: "desc", tag: "ops", status: "exploring", createdAt: "", updatedAt: "" }]} />
    );

    expect(ideasHtml).toContain("alpha");
    expect(ideasHtml).toContain("Idea");
    expect(brainHtml).toContain("All tags");
    expect(brainHtml).toContain("ops");
  });
});
