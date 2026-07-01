import { describe, expect, it } from "vitest";
import { mapBrain, mapBugs, mapIdeas, mapProjects, mapTasks, summarizeStatus } from "./data.js";

describe("server data shaping", () => {
  it("summarizes counts by status", () => {
    const database = {
      prepare(query: string) {
        return {
          all: () => {
            if (query.includes("from tasks")) return [{ status: "pending", count: 2 }];
            if (query.includes("from ideas")) return [{ status: "new", count: 1 }];
            if (query.includes("from brain_ideas")) return [{ status: "exploring", count: 3 }];
            return [{ status: "error", count: 4 }];
          },
          get: () => ({ count: 5 })
        };
      }
    } as any;

    expect(summarizeStatus(database)).toEqual({
      projects: 5,
      tasks: { pending: 2 },
      ideas: { new: 1 },
      brain: { exploring: 3 },
      bugs: { error: 4 }
    });
  });

  it("maps timestamps and dependencies", () => {
    const iso = "1970-01-01T00:00:01.000Z";

    expect(
      mapProjects([
        { id: 1, name: "alpha", path: "/tmp/a", agentsMdPath: null, createdAt: 1, updatedAt: 1, taskCount: 2, ideaCount: 3 }
      ])
    ).toEqual([
      { id: 1, name: "alpha", path: "/tmp/a", agentsMdPath: null, createdAt: iso, updatedAt: iso, taskCount: 2, ideaCount: 3 }
    ]);

    expect(
      mapTasks(
        [{ id: 10, projectId: 1, projectName: "alpha", ideaId: null, title: "Task", description: null, status: "pending", createdAt: 1, updatedAt: 1, complexity: 2 }],
        [{ taskId: 10, dependsOnId: 9 }]
      )
    ).toEqual([
      { id: 10, projectId: 1, projectName: "alpha", ideaId: null, title: "Task", description: null, status: "pending", createdAt: iso, updatedAt: iso, complexity: 2, dependsOn: [9] }
    ]);
  });

  it("maps ideas, brain ideas, and bugs", () => {
    const iso = "1970-01-01T00:00:02.000Z";

    expect(
      mapIdeas([{ id: 1, projectId: 1, projectName: "alpha", title: "Idea", description: null, refinedDescription: null, status: "new", createdAt: 2, updatedAt: 2, complexity: null }])[0].createdAt
    ).toBe(iso);

    expect(mapBrain([{ id: 1, title: "Brain", description: null, tag: "ops", status: "new", createdAt: 2, updatedAt: 2 }])[0].updatedAt).toBe(iso);

    expect(
      mapBugs([{ id: 1, projectId: 1, projectName: "alpha", taskId: null, title: "Bug", description: null, level: "error", status: "new", count: 1, createdAt: 2, updatedAt: 2 }])[0].createdAt
    ).toBe(iso);
  });
});
