export type StatusCount = Record<string, number>;

export type StatusSummary = {
  projects: number;
  tasks: StatusCount;
  ideas: StatusCount;
  brain: StatusCount;
  bugs: StatusCount;
};

export type Project = {
  id: number;
  name: string;
  path: string;
  agentsMdPath: string | null;
  createdAt: string;
  updatedAt: string;
  taskCount: number;
  ideaCount: number;
};

export type TaskStatus = "pending" | "planned" | "in_progress" | "blocked" | "done";

export type Task = {
  id: number;
  projectId: number;
  projectName: string;
  ideaId: number | null;
  title: string;
  description: string | null;
  status: TaskStatus;
  createdAt: string;
  updatedAt: string;
  complexity: number | null;
  dependsOn: number[];
};

export type ActivityBucket = {
  date: string;
  projectId: number;
  projectName: string;
  count: number;
  tasks: Array<{
    id: number;
    title: string;
    doneAt: string;
    durationSeconds: number | null;
  }>;
};

export type Idea = {
  id: number;
  projectId: number;
  projectName: string;
  title: string;
  description: string | null;
  refinedDescription: string | null;
  status: "new" | "refined" | "converted";
  createdAt: string;
  updatedAt: string;
  complexity: number | null;
};

export type BrainIdea = {
  id: number;
  title: string;
  description: string | null;
  tag: string | null;
  status: "new" | "exploring" | "done" | "abandoned";
  createdAt: string;
  updatedAt: string;
};

export type Bug = {
  id: number;
  projectId: number;
  projectName: string;
  taskId: number | null;
  title: string;
  description: string | null;
  level: string | null;
  status: string;
  count: number;
  createdAt: string;
  updatedAt: string;
};

export type ProviderConfig = {
  name: string;
  baseUrl: string;
};

export type LogposeConfig = {
  models: Record<string, string>;
  providers: ProviderConfig[];
};
