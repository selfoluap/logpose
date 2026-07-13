import Database from "better-sqlite3";
import express from "express";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { mapActivity, mapBrain, mapBugs, mapIdeas, mapProjects, mapTasks, summarizeStatus } from "./data.js";

const app = express();
const port = Number(process.env.PORT ?? 3737);
const dbPath = path.join(os.homedir(), ".logpose", "tix.db");
const rootDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const logDir = path.join(os.homedir(), ".logpose", "logs");

function parseTime(value: unknown) {
  if (typeof value === "number") return value / 1000;
  if (typeof value !== "string") return null;

  const ms = Date.parse(value.replace("Z", "+00:00"));
  return Number.isNaN(ms) ? null : ms / 1000;
}

function taskDuration(taskId: number) {
  const file = path.join(logDir, `task-${taskId}-build.jsonl`);
  if (!fs.existsSync(file)) return null;

  let firstStart: number | null = null;
  let lastFinish: number | null = null;

  for (const line of fs.readFileSync(file, "utf8").split("\n")) {
    if (!line) continue;

    try {
      const event = JSON.parse(line) as { type?: string; timestamp?: unknown; part?: { type?: string } };
      if (event.type === "step_start" || event.part?.type === "step-start") {
        firstStart ??= parseTime(event.timestamp);
      } else if (event.type === "step_finish" || event.part?.type === "step-finish") {
        lastFinish = parseTime(event.timestamp) ?? lastFinish;
      }
    } catch {
      // Ignore partial log lines from interrupted builds.
    }
  }

  return firstStart === null || lastFinish === null ? null : Math.max(0, Math.round(lastFinish - firstStart));
}

function openDb() {
  if (!fs.existsSync(dbPath)) {
    throw new Error(`Database not found: ${dbPath}`);
  }

  return new Database(dbPath, { readonly: true });
}

function withDb<T>(run: (database: Database.Database) => T) {
  const database = openDb();

  try {
    return run(database);
  } finally {
    database.close();
  }
}

app.get("/api/status", (_req, res, next) => {
  try {
    res.json(withDb((database) => summarizeStatus(database)));
  } catch (error) {
    next(error);
  }
});

app.get("/api/projects", (_req, res, next) => {
  try {
    res.json(
      withDb((database) =>
        mapProjects(
          database
            .prepare(
              `
                select
                  p.id,
                  p.name,
                  p.path,
                  p.agents_md_path as agentsMdPath,
                  p.created_at as createdAt,
                  p.updated_at as updatedAt,
                  count(distinct t.id) as taskCount,
                  count(distinct i.id) as ideaCount
                from projects p
                left join tasks t on t.project_id = p.id
                left join ideas i on i.project_id = p.id
                group by p.id
                order by p.name
              `
            )
            .all() as Array<Record<string, unknown> & { createdAt: unknown; updatedAt: unknown }>
        )
      )
    );
  } catch (error) {
    next(error);
  }
});

app.get("/api/tasks", (_req, res, next) => {
  try {
    res.json(
      withDb((database) =>
        mapTasks(
          database
            .prepare(
              `
                select
                  t.id,
                  t.project_id as projectId,
                  p.name as projectName,
                  t.idea_id as ideaId,
                  t.title,
                  t.description,
                  t.status,
                  t.created_at as createdAt,
                  t.updated_at as updatedAt,
                  t.complexity
                from tasks t
                join projects p on p.id = t.project_id
                order by t.updated_at desc
              `
            )
            .all() as Array<Record<string, unknown> & { id: unknown; createdAt: unknown; updatedAt: unknown }>,
          database.prepare("select task_id as taskId, depends_on_id as dependsOnId from task_deps").all() as Array<{
            taskId: number;
            dependsOnId: number;
          }>
        )
      )
    );
  } catch (error) {
    next(error);
  }
});

app.get("/api/activity", (_req, res, next) => {
  try {
    res.json(
      withDb((database) => {
        const rows = database
          .prepare(
            `
              select
                t.id,
                t.project_id as projectId,
                p.name as projectName,
                t.title,
                t.updated_at as updatedAt
              from tasks t
              join projects p on p.id = t.project_id
              where t.status = 'done'
              order by t.updated_at asc
            `
          )
          .all() as Array<Record<string, unknown> & { id: unknown; projectId: unknown; projectName: string; title: string; updatedAt: unknown }>;
        const durations = new Map(rows.map((row) => [Number(row.id), taskDuration(Number(row.id))]).filter((row): row is [number, number] => row[1] !== null));

        return mapActivity(rows, durations);
      })
    );
  } catch (error) {
    next(error);
  }
});

app.get("/api/ideas", (_req, res, next) => {
  try {
    res.json(
      withDb((database) =>
        mapIdeas(
          database
            .prepare(
              `
                select
                  i.id,
                  i.project_id as projectId,
                  p.name as projectName,
                  i.title,
                  i.description,
                  i.refined_description as refinedDescription,
                  i.status,
                  i.created_at as createdAt,
                  i.updated_at as updatedAt,
                  i.complexity
                from ideas i
                join projects p on p.id = i.project_id
                order by p.name, i.updated_at desc
              `
            )
            .all() as Array<Record<string, unknown> & { createdAt: unknown; updatedAt: unknown }>
        )
      )
    );
  } catch (error) {
    next(error);
  }
});

app.get("/api/brain", (_req, res, next) => {
  try {
    res.json(
      withDb((database) =>
        mapBrain(
          database
            .prepare(
              `
                select
                  id,
                  title,
                  description,
                  tag,
                  status,
                  created_at as createdAt,
                  updated_at as updatedAt
                from brain_ideas
                order by updated_at desc
              `
            )
            .all() as Array<Record<string, unknown> & { createdAt: unknown; updatedAt: unknown }>
        )
      )
    );
  } catch (error) {
    next(error);
  }
});

app.get("/api/bugs", (_req, res, next) => {
  try {
    res.json(
      withDb((database) =>
        mapBugs(
          database
            .prepare(
              `
                select
                  b.id,
                  b.project_id as projectId,
                  p.name as projectName,
                  b.task_id as taskId,
                  b.title,
                  b.description,
                  b.level,
                  b.status,
                  b.count,
                  b.created_at as createdAt,
                  b.updated_at as updatedAt
                from bugs b
                join projects p on p.id = b.project_id
                order by b.updated_at desc
              `
            )
            .all() as Array<Record<string, unknown> & { createdAt: unknown; updatedAt: unknown }>
        )
      )
    );
  } catch (error) {
    next(error);
  }
});

if (process.env.NODE_ENV === "production") {
  const distDir = path.join(rootDir, "dist");
  app.use(express.static(distDir));
  app.get("*", (_req, res) => res.sendFile(path.join(distDir, "index.html")));
}

app.use((error: unknown, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  res.status(500).json({ error: error instanceof Error ? error.message : "Unknown error" });
});

app.listen(port, "127.0.0.1", () => {
  console.log(`logpose-ui listening on http://127.0.0.1:${port}`);
});
