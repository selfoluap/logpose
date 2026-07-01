import type { BrainIdea, Bug, Idea, Project, StatusSummary, Task } from "../types";

async function getJson<T>(path: string): Promise<T> {
  const response = await fetch(path);

  if (!response.ok) {
    throw new Error(await response.text());
  }

  return response.json() as Promise<T>;
}

export const api = {
  status: () => getJson<StatusSummary>("/api/status"),
  projects: () => getJson<Project[]>("/api/projects"),
  tasks: () => getJson<Task[]>("/api/tasks"),
  ideas: () => getJson<Idea[]>("/api/ideas"),
  brain: () => getJson<BrainIdea[]>("/api/brain"),
  bugs: () => getJson<Bug[]>("/api/bugs")
};
