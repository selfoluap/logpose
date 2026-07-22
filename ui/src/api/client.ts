import type { ActivityBucket, BrainIdea, Bug, Idea, LogposeConfig, Project, StatusSummary, Task } from "../types";

async function getJson<T>(path: string): Promise<T> {
  const response = await fetch(path);

  if (!response.ok) {
    throw new Error(await response.text());
  }

  return response.json() as Promise<T>;
}

async function sendJson<T>(path: string, method: string, body?: unknown): Promise<T> {
  const response = await fetch(path, {
    method,
    headers: { "content-type": "application/json" },
    body: body === undefined ? undefined : JSON.stringify(body)
  });

  if (!response.ok) {
    throw new Error(await response.text());
  }

  return response.json() as Promise<T>;
}

export const api = {
  status: () => getJson<StatusSummary>("/api/status"),
  activity: () => getJson<ActivityBucket[]>("/api/activity"),
  projects: () => getJson<Project[]>("/api/projects"),
  tasks: () => getJson<Task[]>("/api/tasks"),
  ideas: () => getJson<Idea[]>("/api/ideas"),
  brain: () => getJson<BrainIdea[]>("/api/brain"),
  bugs: () => getJson<Bug[]>("/api/bugs"),
  config: () => getJson<LogposeConfig>("/api/config"),
  saveConfig: (config: LogposeConfig) => sendJson<LogposeConfig>("/api/config", "PUT", config),
  resetConfig: () => sendJson<LogposeConfig>("/api/config/reset", "POST")
};
