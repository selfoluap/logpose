import { createRoot } from "react-dom/client";
import { renderToStaticMarkup } from "react-dom/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act } from "react";
import App from "../App";
import { ActivityTimeline } from "./ActivityTimeline";
import { BrainList } from "./BrainList";
import { Dashboard } from "./Dashboard";
import { IdeasList } from "./IdeasList";
import { KanbanBoard } from "./KanbanBoard";
import { ProjectDetail } from "./ProjectDetail";

beforeEach(() => {
  globalThis.IS_REACT_ACT_ENVIRONMENT = true;
});

describe("dashboard views", () => {
  it("styles completed activity graph and table", () => {
    const html = renderToStaticMarkup(
      <ActivityTimeline
        buckets={[{ date: "2026-01-02", projectId: 1, projectName: "alpha", count: 3, tasks: [{ id: 7, title: "Done task", doneAt: "2026-01-02T00:00:00.000Z", durationSeconds: 120 }] }]}
      />
    );

    expect(html).toContain('class="mx-auto w-full overflow-x-auto"');
    expect(html).toContain('class="w-full min-w-full text-left text-sm"');
    expect(html).toContain('class="border-b border-[var(--line)] px-3 py-3 text-center text-xl font-bold normal-case tracking-normal text-[var(--text)]"');
    expect(html).toContain('class="w-10 text-right text-sm font-bold text-[var(--text)]"');
    expect(html).toContain('class="h-4 rounded bg-[var(--online)]"');
    expect(html).toContain("width:100%");
  });

  it("renders dashboard totals and work history", () => {
    const html = renderToStaticMarkup(
      <Dashboard
        status={{ projects: 2, tasks: { pending: 1, done: 2 }, ideas: { new: 3 }, brain: { exploring: 4 }, bugs: { error: 1 } }}
        projects={[{ id: 1, name: "alpha", path: "/tmp/a", agentsMdPath: null, createdAt: "", updatedAt: "", taskCount: 2, ideaCount: 1 }]}
        activity={[
          { date: "2026-01-02", projectId: 1, projectName: "alpha", count: 1, tasks: [{ id: 7, title: "Done task", doneAt: "2026-01-02T00:00:00.000Z", durationSeconds: 120 }] },
          { date: "2026-01-02", projectId: 2, projectName: "beta", count: 1, tasks: [{ id: 8, title: "Other task", doneAt: "2026-01-02T01:00:00.000Z", durationSeconds: null }] }
        ]}
        onProjectSelect={() => undefined}
      />
    );

    expect(html).toContain("Projects");
    expect(html).toContain("Brain Ideas");
    expect(html).toContain("Work history");
    expect(html).toContain("Completed work by project");
    expect(html).toContain("cursor-pointer");
    expect(html).toContain('tabindex="0"');
    expect(html).toContain('role="button"');
    expect(html).toContain("bg-[var(--online)]");
    expect(html).toContain("<table");
    expect(html).toContain("2026-01-02");
    expect(html).toContain("alpha");
  });

  it("renders project drilldown", () => {
    const doneAt = new Date().toISOString();
    const html = renderToStaticMarkup(
      <ProjectDetail
        project={{ id: 1, name: "alpha", path: "/tmp/a", agentsMdPath: "/tmp/a/AGENTS.md", createdAt: "", updatedAt: "", taskCount: 2, ideaCount: 1 }}
        tasks={[{ id: 1, projectId: 1, projectName: "alpha", ideaId: null, title: "Ship UI", description: null, status: "done", createdAt: "", updatedAt: "", complexity: 2, dependsOn: [] }]}
        activity={[{ date: doneAt.slice(0, 10), projectId: 1, projectName: "alpha", count: 1, tasks: [{ id: 1, title: "Ship UI", doneAt, durationSeconds: 60 }] }]}
        onBack={() => undefined}
      />
    );

    expect(html).toContain("Back to work history");
    expect(html).toContain("Project activity");
    expect(html).toContain("<select");
    expect(html).toContain("24 hours");
    expect(html).toContain("completed task");
    expect(html).toContain("bg-[var(--online)]/90");
    expect(html).toContain("Task overview");
  });

  it("switches project activity ranges", () => {
    const container = document.createElement("div");
    document.body.append(container);
    const root = createRoot(container);

    act(() => {
      root.render(
        <ProjectDetail
          project={{ id: 1, name: "alpha", path: "/tmp/a", agentsMdPath: null, createdAt: "", updatedAt: "", taskCount: 1, ideaCount: 0 }}
          tasks={[]}
          activity={[{ date: new Date().toISOString().slice(0, 10), projectId: 1, projectName: "alpha", count: 1, tasks: [{ id: 1, title: "Done", doneAt: new Date().toISOString(), durationSeconds: null }] }]}
          onBack={() => undefined}
        />
      );
    });

    const select = container.querySelector("select")!;
    act(() => {
      select.value = "1w";
      select.dispatchEvent(new Event("change", { bubbles: true }));
    });

    expect(container.textContent).toContain("last 1 week");

    act(() => { root.unmount(); });
    container.remove();
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

  it("hides converted ideas from list", () => {
    const html = renderToStaticMarkup(
      <IdeasList
        ideas={[
          { id: 1, projectId: 1, projectName: "alpha", title: "New one", description: null, refinedDescription: null, status: "new", createdAt: "", updatedAt: "", complexity: null },
          { id: 2, projectId: 1, projectName: "alpha", title: "Refined one", description: null, refinedDescription: null, status: "refined", createdAt: "", updatedAt: "", complexity: 2 },
          { id: 3, projectId: 1, projectName: "alpha", title: "Done one", description: null, refinedDescription: null, status: "converted", createdAt: "", updatedAt: "", complexity: null }
        ]}
      />
    );

    expect(html).toContain("New one");
    expect(html).toContain("Refined one");
    expect(html).not.toContain("Done one");
  });

  it("renders nothing when all ideas are converted", () => {
    const html = renderToStaticMarkup(
      <IdeasList ideas={[{ id: 1, projectId: 1, projectName: "alpha", title: "Done", description: null, refinedDescription: null, status: "converted", createdAt: "", updatedAt: "", complexity: null }]} />
    );

    expect(html).not.toContain("Done");
    expect(html).not.toContain("alpha");
  });

  it("activates project drilldown from work-history table via click and keyboard", () => {
    const onSelect = vi.fn();
    const projects = [
      { id: 1, name: "alpha", path: "/tmp/a", agentsMdPath: null, createdAt: "", updatedAt: "", taskCount: 2, ideaCount: 1 },
      { id: 2, name: "beta", path: "/tmp/b", agentsMdPath: null, createdAt: "", updatedAt: "", taskCount: 3, ideaCount: 0 },
    ];
    const activity = [
      { date: "2026-01-02", projectId: 1, projectName: "alpha", count: 1, tasks: [] },
      { date: "2026-01-03", projectId: 2, projectName: "beta", count: 2, tasks: [] },
    ];

    const container = document.createElement("div");
    document.body.append(container);
    const root = createRoot(container);
    act(() => {
      root.render(
        <Dashboard
          status={{ projects: 2, tasks: { done: 5 }, ideas: { new: 1 }, brain: { exploring: 0 }, bugs: { error: 0 } }}
          projects={projects}
          activity={activity}
          onProjectSelect={onSelect}
        />
      );
    });

    const rows = container.querySelectorAll<HTMLTableRowElement>("tbody tr");
    expect(rows.length).toBe(2);

    // Click on first row
    act(() => { rows[0]!.click(); });
    expect(onSelect).toHaveBeenCalledWith(1);
    onSelect.mockClear();

    // Keyboard Enter on second row
    act(() => { rows[1]!.dispatchEvent(new KeyboardEvent("keydown", { key: "Enter", bubbles: true })); });
    expect(onSelect).toHaveBeenCalledWith(2);
    onSelect.mockClear();

    // Keyboard Space on first row
    act(() => { rows[0]!.dispatchEvent(new KeyboardEvent("keydown", { key: " ", bubbles: true })); });
    expect(onSelect).toHaveBeenCalledWith(1);

    act(() => { root.unmount(); });
    container.remove();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("renders app dashboard and drills down to project detail from work-history table via click and keyboard", async () => {
    const projects = [
      { id: 1, name: "alpha", path: "/tmp/a", agentsMdPath: null, createdAt: "2026-01-01", updatedAt: "2026-01-02", taskCount: 2, ideaCount: 1 },
      { id: 2, name: "beta", path: "/tmp/b", agentsMdPath: "/tmp/b/AGENTS.md", createdAt: "2026-01-01", updatedAt: "2026-01-03", taskCount: 3, ideaCount: 0 },
    ];

    vi.spyOn(globalThis, "fetch").mockImplementation((url: string) => {
      const data: Record<string, unknown> = {
        "/api/status": { projects: 2, tasks: { pending: 0, done: 5 }, ideas: { new: 1 }, brain: { exploring: 0 }, bugs: { error: 0 } },
        "/api/projects": projects,
        "/api/activity": [],
        "/api/tasks": [],
        "/api/ideas": [],
        "/api/brain": [],
      };
      return Promise.resolve({ ok: true, json: () => Promise.resolve(data[url] ?? []) });
    });

    const container = document.createElement("div");
    document.body.append(container);
    const root = createRoot(container);

    await act(async () => { root.render(<App />); });
    await act(async () => {});

    expect(container.textContent).toContain("Work history");
    const rows = container.querySelectorAll<HTMLTableRowElement>("tbody tr");
    expect(rows.length).toBe(2);

    act(() => { rows[0]!.click(); });
    expect(container.textContent).toContain("Back to work history");
    expect(container.textContent).toContain("Project activity");
    expect(container.textContent).toContain("alpha");
    expect(container.textContent).toContain("Task overview");

    const backButton = [...container.querySelectorAll("button")].find((b) => b.textContent === "Back to work history")!;
    act(() => { backButton.click(); });
    expect(container.textContent).toContain("Work history");

    const rows2 = container.querySelectorAll<HTMLTableRowElement>("tbody tr");
    act(() => { rows2[1]!.dispatchEvent(new KeyboardEvent("keydown", { key: "Enter", bubbles: true })); });
    expect(container.textContent).toContain("Back to work history");
    expect(container.textContent).toContain("beta");

    act(() => { root.unmount(); });
    container.remove();
  });

  it("does not leak mocked fetch into later tests", () => {
    // The previous test (app drilldown) replaces globalThis.fetch with a mock
    // and afterEach calls vi.restoreAllMocks(). If fetch is properly restored,
    // calling fetch without a server should reject (not resolve with {}).
    // We check that fetch is the global fetch (not a vi.fn() still returning undefined).
    const fetchDescriptor = Object.getOwnPropertyDescriptor(globalThis, "fetch");
    expect(fetchDescriptor?.get).toBeUndefined();
    // If fetch was a vi.fn() property, its set would still point to the spy setter
    // which replaces globalThis.fetch. Instead, fetch should just be the native function.
    // A quick smoke test: calling fetch without a server should reject.
    if (typeof fetch !== "function") {
      throw new Error("fetch is not a function");
    }
    // If fetch is still the vi.fn() mock (after vi.restoreAllMocks cleared its impl),
    // it returns undefined, not a promise — so calling .catch would throw.
    // Real fetch returns a promise that rejects with a TypeError.
    const result = fetch("http://127.0.0.1:1/");
    expect(result).toBeInstanceOf(Promise);
    // If it's the leaked mock, .catch() throws because undefined is not thenable
    expect(() => result.then(() => {}, () => {})).not.toThrow();
  });
});
