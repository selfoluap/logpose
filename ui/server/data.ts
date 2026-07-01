import type Database from "better-sqlite3";

type Row = Record<string, unknown>;

function toIso(value: unknown) {
  return new Date(Number(value) * 1000).toISOString();
}

function mapTimes<T extends Row & { createdAt: unknown; updatedAt: unknown }>(rows: T[]) {
  return rows.map((row) => ({
    ...row,
    createdAt: toIso(row.createdAt),
    updatedAt: toIso(row.updatedAt)
  }));
}

function countByStatus(database: Database.Database, table: string) {
  return Object.fromEntries(
    (database.prepare(`select status, count(*) as count from ${table} group by status`).all() as Array<{ status: string; count: number }>).map(
      (row) => [row.status, row.count]
    )
  );
}

export function summarizeStatus(database: Database.Database) {
  return {
    projects: (database.prepare("select count(*) as count from projects").get() as { count: number }).count,
    tasks: countByStatus(database, "tasks"),
    ideas: countByStatus(database, "ideas"),
    brain: countByStatus(database, "brain_ideas"),
    bugs: countByStatus(database, "bugs")
  };
}

export function mapProjects(rows: Array<Row & { createdAt: unknown; updatedAt: unknown }>) {
  return mapTimes(rows);
}

export function mapTasks(
  rows: Array<Row & { id: unknown; createdAt: unknown; updatedAt: unknown }>,
  deps: Array<{ taskId: number; dependsOnId: number }>
) {
  const byTask = new Map<number, number[]>();

  for (const dep of deps) {
    byTask.set(dep.taskId, [...(byTask.get(dep.taskId) ?? []), dep.dependsOnId]);
  }

  return mapTimes(rows).map((row) => ({
    ...row,
    dependsOn: byTask.get(Number(row.id)) ?? []
  }));
}

export function mapIdeas(rows: Array<Row & { createdAt: unknown; updatedAt: unknown }>) {
  return mapTimes(rows);
}

export function mapBrain(rows: Array<Row & { createdAt: unknown; updatedAt: unknown }>) {
  return mapTimes(rows);
}

export function mapBugs(rows: Array<Row & { createdAt: unknown; updatedAt: unknown }>) {
  return mapTimes(rows);
}
