import { env } from "cloudflare:workers";

export const STATUSES = ["ยังไม่เริ่ม", "กำลังทำ", "เสร็จ", "ติดปัญหา"] as const;

export type TaskStatus = (typeof STATUSES)[number];

export type OwnerRecord = {
  id: string;
  name: string;
  email?: string | null;
};

export type GroupRecord = {
  id: string;
  sheetName: string;
  ownerId?: string | null;
  code?: string | null;
  title: string;
  sortOrder: number;
};

export type TaskRecord = {
  id: string;
  groupId?: string | null;
  ownerId?: string | null;
  sourceSheet: string;
  sourceRow: number;
  code?: string | null;
  title: string;
  detailLevel: number;
  frequency: string;
  scheduleNote?: string | null;
  dueDay?: number | null;
  dueMonth?: number | null;
  currentStatus: TaskStatus;
  note?: string | null;
  sortOrder: number;
  importedStatus?: string | null;
};

export type ScheduleRecord = {
  id: string;
  taskId: string;
  month?: number | null;
  day?: number | null;
  periodLabel?: string | null;
  note?: string | null;
};

export type ImportPayload = {
  fileName: string;
  owners: OwnerRecord[];
  groups: GroupRecord[];
  tasks: TaskRecord[];
  schedules: ScheduleRecord[];
};

type D1Result<T = Record<string, unknown>> = {
  results?: T[];
};

const schemaStatements = [
  `CREATE TABLE IF NOT EXISTS owners (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL UNIQUE,
    email TEXT,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
  )`,
  `CREATE TABLE IF NOT EXISTS task_groups (
    id TEXT PRIMARY KEY,
    sheet_name TEXT NOT NULL,
    owner_id TEXT,
    code TEXT,
    title TEXT NOT NULL,
    sort_order INTEGER NOT NULL,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
  )`,
  `CREATE TABLE IF NOT EXISTS tasks (
    id TEXT PRIMARY KEY,
    group_id TEXT,
    owner_id TEXT,
    source_sheet TEXT NOT NULL,
    source_row INTEGER NOT NULL,
    code TEXT,
    title TEXT NOT NULL,
    detail_level INTEGER NOT NULL DEFAULT 0,
    frequency TEXT NOT NULL DEFAULT 'ไม่ระบุ',
    schedule_note TEXT,
    due_day INTEGER,
    due_month INTEGER,
    current_status TEXT NOT NULL DEFAULT 'ยังไม่เริ่ม',
    note TEXT,
    sort_order INTEGER NOT NULL,
    imported_status TEXT,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
  )`,
  `CREATE TABLE IF NOT EXISTS task_schedules (
    id TEXT PRIMARY KEY,
    task_id TEXT NOT NULL,
    month INTEGER,
    day INTEGER,
    period_label TEXT,
    note TEXT
  )`,
  `CREATE TABLE IF NOT EXISTS status_updates (
    id TEXT PRIMARY KEY,
    task_id TEXT NOT NULL,
    previous_status TEXT,
    next_status TEXT NOT NULL,
    note TEXT,
    changed_by TEXT,
    changed_at TEXT NOT NULL
  )`,
  `CREATE TABLE IF NOT EXISTS activity_log (
    id TEXT PRIMARY KEY,
    action TEXT NOT NULL,
    entity_type TEXT NOT NULL,
    entity_id TEXT,
    detail TEXT,
    actor_email TEXT,
    created_at TEXT NOT NULL
  )`,
  `CREATE TABLE IF NOT EXISTS import_batches (
    id TEXT PRIMARY KEY,
    file_name TEXT NOT NULL,
    imported_by TEXT,
    imported_at TEXT NOT NULL,
    owner_count INTEGER NOT NULL,
    task_count INTEGER NOT NULL
  )`,
  `CREATE INDEX IF NOT EXISTS tasks_owner_idx ON tasks (owner_id)`,
  `CREATE INDEX IF NOT EXISTS tasks_group_idx ON tasks (group_id)`,
  `CREATE INDEX IF NOT EXISTS tasks_status_idx ON tasks (current_status)`,
  `CREATE INDEX IF NOT EXISTS task_schedules_task_idx ON task_schedules (task_id)`,
];

export function getD1() {
  if (!env.DB) {
    throw new Error("D1 binding `DB` is unavailable.");
  }

  return env.DB;
}

export async function ensureSchema() {
  const db = getD1();
  for (const statement of schemaStatements) {
    await db.prepare(statement).run();
  }
}

function nowIso() {
  return new Date().toISOString();
}

function safeStatus(status: string): TaskStatus {
  return STATUSES.includes(status as TaskStatus)
    ? (status as TaskStatus)
    : "ยังไม่เริ่ม";
}

export function actorFromRequest(request: Request) {
  return (
    request.headers.get("oai-authenticated-user-email") ??
    request.headers.get("x-user-email") ??
    "local-user"
  );
}

export async function loadTrackerData() {
  await ensureSchema();
  const db = getD1();
  const [owners, groups, tasks, schedules, updates, batches] = await Promise.all([
    db.prepare("SELECT id, name, email FROM owners ORDER BY name").all(),
    db
      .prepare(
        "SELECT id, sheet_name AS sheetName, owner_id AS ownerId, code, title, sort_order AS sortOrder FROM task_groups ORDER BY sort_order"
      )
      .all(),
    db
      .prepare(
        `SELECT
          tasks.id,
          tasks.group_id AS groupId,
          tasks.owner_id AS ownerId,
          owners.name AS ownerName,
          task_groups.title AS groupTitle,
          tasks.source_sheet AS sourceSheet,
          tasks.source_row AS sourceRow,
          tasks.code,
          tasks.title,
          tasks.detail_level AS detailLevel,
          tasks.frequency,
          tasks.schedule_note AS scheduleNote,
          tasks.due_day AS dueDay,
          tasks.due_month AS dueMonth,
          tasks.current_status AS currentStatus,
          tasks.note,
          tasks.sort_order AS sortOrder,
          tasks.imported_status AS importedStatus,
          tasks.updated_at AS updatedAt
        FROM tasks
        LEFT JOIN owners ON owners.id = tasks.owner_id
        LEFT JOIN task_groups ON task_groups.id = tasks.group_id
        ORDER BY tasks.sort_order`
      )
      .all(),
    db
      .prepare(
        "SELECT id, task_id AS taskId, month, day, period_label AS periodLabel, note FROM task_schedules ORDER BY month, day"
      )
      .all(),
    db
      .prepare(
        "SELECT id, task_id AS taskId, previous_status AS previousStatus, next_status AS nextStatus, note, changed_by AS changedBy, changed_at AS changedAt FROM status_updates ORDER BY changed_at DESC LIMIT 100"
      )
      .all(),
    db
      .prepare(
        "SELECT id, file_name AS fileName, imported_by AS importedBy, imported_at AS importedAt, owner_count AS ownerCount, task_count AS taskCount FROM import_batches ORDER BY imported_at DESC LIMIT 5"
      )
      .all(),
  ]);

  return {
    owners: (owners as D1Result).results ?? [],
    groups: (groups as D1Result).results ?? [],
    tasks: (tasks as D1Result).results ?? [],
    schedules: (schedules as D1Result).results ?? [],
    updates: (updates as D1Result).results ?? [],
    batches: (batches as D1Result).results ?? [],
    statuses: STATUSES,
  };
}

export async function replaceImport(payload: ImportPayload, actor: string) {
  await ensureSchema();
  const db = getD1();
  const importedAt = nowIso();
  const batchId = crypto.randomUUID();

  await db.batch([
    db.prepare("DELETE FROM task_schedules"),
    db.prepare("DELETE FROM status_updates"),
    db.prepare("DELETE FROM activity_log"),
    db.prepare("DELETE FROM tasks"),
    db.prepare("DELETE FROM task_groups"),
    db.prepare("DELETE FROM owners"),
    db.prepare("DELETE FROM import_batches"),
  ]);

  const operations: D1PreparedStatement[] = [];

  for (const owner of payload.owners) {
    operations.push(
      db
        .prepare("INSERT INTO owners (id, name, email) VALUES (?, ?, ?)")
        .bind(owner.id, owner.name, owner.email ?? null)
    );
  }

  for (const group of payload.groups) {
    operations.push(
      db
        .prepare(
          "INSERT INTO task_groups (id, sheet_name, owner_id, code, title, sort_order) VALUES (?, ?, ?, ?, ?, ?)"
        )
        .bind(
          group.id,
          group.sheetName,
          group.ownerId ?? null,
          group.code ?? null,
          group.title,
          group.sortOrder
        )
    );
  }

  for (const task of payload.tasks) {
    operations.push(
      db
        .prepare(
          `INSERT INTO tasks (
            id, group_id, owner_id, source_sheet, source_row, code, title,
            detail_level, frequency, schedule_note, due_day, due_month,
            current_status, note, sort_order, imported_status, updated_at
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
        )
        .bind(
          task.id,
          task.groupId ?? null,
          task.ownerId ?? null,
          task.sourceSheet,
          task.sourceRow,
          task.code ?? null,
          task.title,
          task.detailLevel,
          task.frequency,
          task.scheduleNote ?? null,
          task.dueDay ?? null,
          task.dueMonth ?? null,
          safeStatus(task.currentStatus),
          task.note ?? null,
          task.sortOrder,
          task.importedStatus ?? null,
          importedAt
        )
    );
  }

  for (const schedule of payload.schedules) {
    operations.push(
      db
        .prepare(
          "INSERT INTO task_schedules (id, task_id, month, day, period_label, note) VALUES (?, ?, ?, ?, ?, ?)"
        )
        .bind(
          schedule.id,
          schedule.taskId,
          schedule.month ?? null,
          schedule.day ?? null,
          schedule.periodLabel ?? null,
          schedule.note ?? null
        )
    );
  }

  operations.push(
    db
      .prepare(
        "INSERT INTO import_batches (id, file_name, imported_by, imported_at, owner_count, task_count) VALUES (?, ?, ?, ?, ?, ?)"
      )
      .bind(batchId, payload.fileName, actor, importedAt, payload.owners.length, payload.tasks.length),
    db
      .prepare(
        "INSERT INTO activity_log (id, action, entity_type, entity_id, detail, actor_email, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)"
      )
      .bind(
        crypto.randomUUID(),
        "import",
        "import_batch",
        batchId,
        JSON.stringify({ fileName: payload.fileName, taskCount: payload.tasks.length }),
        actor,
        importedAt
      )
  );

  for (let index = 0; index < operations.length; index += 50) {
    await db.batch(operations.slice(index, index + 50));
  }

  return { batchId, importedAt };
}

export async function updateTaskStatus(
  taskId: string,
  nextStatus: string,
  note: string | null,
  actor: string
) {
  await ensureSchema();
  const db = getD1();
  const safeNext = safeStatus(nextStatus);
  const current = await db
    .prepare("SELECT current_status AS currentStatus FROM tasks WHERE id = ?")
    .bind(taskId)
    .first<{ currentStatus: string }>();

  if (!current) {
    return null;
  }

  const changedAt = nowIso();
  const updateId = crypto.randomUUID();

  await db.batch([
    db
      .prepare("UPDATE tasks SET current_status = ?, note = COALESCE(?, note), updated_at = ? WHERE id = ?")
      .bind(safeNext, note, changedAt, taskId),
    db
      .prepare(
        "INSERT INTO status_updates (id, task_id, previous_status, next_status, note, changed_by, changed_at) VALUES (?, ?, ?, ?, ?, ?, ?)"
      )
      .bind(updateId, taskId, current.currentStatus, safeNext, note, actor, changedAt),
    db
      .prepare(
        "INSERT INTO activity_log (id, action, entity_type, entity_id, detail, actor_email, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)"
      )
      .bind(
        crypto.randomUUID(),
        "status_update",
        "task",
        taskId,
        JSON.stringify({ previousStatus: current.currentStatus, nextStatus: safeNext }),
        actor,
        changedAt
      ),
  ]);

  return {
    id: updateId,
    taskId,
    previousStatus: current.currentStatus,
    nextStatus: safeNext,
    note,
    changedBy: actor,
    changedAt,
  };
}
