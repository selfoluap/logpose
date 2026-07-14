import { Brain, KanbanSquare, LayoutDashboard, Lightbulb } from "lucide-react";
import { useEffect, useState } from "react";
import { api } from "./api/client";
import { BrainList } from "./components/BrainList";
import { Dashboard } from "./components/Dashboard";
import { IdeasList } from "./components/IdeasList";
import { KanbanBoard } from "./components/KanbanBoard";
import { ProjectDetail } from "./components/ProjectDetail";
import { Sidebar } from "./components/Sidebar";
import type { ActivityBucket, BrainIdea, Idea, Project, StatusSummary, Task } from "./types";

const views = [
  { id: "dashboard", label: "Dashboard", icon: LayoutDashboard },
  { id: "tasks", label: "Tasks", icon: KanbanSquare },
  { id: "ideas", label: "Ideas", icon: Lightbulb },
  { id: "brain", label: "Brain", icon: Brain }
] as const;

export type View = (typeof views)[number]["id"];

export default function App() {
  const [view, setView] = useState<View>("dashboard");
  const [status, setStatus] = useState<StatusSummary | null>(null);
  const [projects, setProjects] = useState<Project[]>([]);
  const [activity, setActivity] = useState<ActivityBucket[]>([]);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [ideas, setIdeas] = useState<Idea[]>([]);
  const [brain, setBrain] = useState<BrainIdea[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [selectedProjectId, setSelectedProjectId] = useState<number | null>(null);
  const selectedProject = projects.find((project) => project.id === selectedProjectId) ?? null;

  useEffect(() => {
    Promise.all([api.status(), api.projects(), api.activity(), api.tasks(), api.ideas(), api.brain()])
      .then(([nextStatus, nextProjects, nextActivity, nextTasks, nextIdeas, nextBrain]) => {
        setStatus(nextStatus);
        setProjects(nextProjects);
        setActivity(nextActivity);
        setTasks(nextTasks);
        setIdeas(nextIdeas);
        setBrain(nextBrain);
      })
      .catch((nextError: unknown) => {
        setError(nextError instanceof Error ? nextError.message : "Failed to load data");
      });
  }, []);

  return (
    <div className="min-h-screen md:grid md:grid-cols-[14rem_1fr]">
      <Sidebar
        views={views}
        active={view}
        onChange={(nextView) => {
          setView(nextView);
          setSelectedProjectId(null);
        }}
      />
      <main className="p-4 md:p-6">
        <div className="mb-5 flex items-center justify-between gap-4">
          <div>
            <h1 className="text-xl font-semibold tracking-tight">Logpose</h1>
            <p className="text-sm text-[var(--muted)]">Local ticket dashboard</p>
          </div>
        </div>
        {error ? <div className="panel p-4 text-sm text-red-300">{error}</div> : null}
        {!error && view === "dashboard" && selectedProject ? (
          <ProjectDetail
            project={selectedProject}
            tasks={tasks.filter((task) => task.projectId === selectedProject.id)}
            activity={activity.filter((bucket) => bucket.projectId === selectedProject.id)}
            onBack={() => setSelectedProjectId(null)}
          />
        ) : null}
        {!error && view === "dashboard" && !selectedProject ? <Dashboard status={status} projects={projects} activity={activity} onProjectSelect={setSelectedProjectId} /> : null}
        {!error && view === "tasks" ? <KanbanBoard tasks={tasks} projects={projects} /> : null}
        {!error && view === "ideas" ? <IdeasList ideas={ideas} /> : null}
        {!error && view === "brain" ? <BrainList brain={brain} /> : null}
      </main>
    </div>
  );
}
