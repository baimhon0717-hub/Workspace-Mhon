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
  ownerName?: string | null;
  groupTitle?: string | null;
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
  updatedAt?: string | null;
};

export type ScheduleRecord = {
  id: string;
  taskId: string;
  month?: number | null;
  day?: number | null;
  periodLabel?: string | null;
  note?: string | null;
};

export type StatusUpdateRecord = {
  id: string;
  taskId: string;
  previousStatus?: string | null;
  nextStatus: TaskStatus;
  note?: string | null;
  changedBy?: string | null;
  changedAt: string;
};

export type ImportBatchRecord = {
  id: string;
  fileName: string;
  importedBy?: string | null;
  importedAt: string;
  ownerCount: number;
  taskCount: number;
};

export type ImportPayload = {
  fileName: string;
  owners: OwnerRecord[];
  groups: GroupRecord[];
  tasks: TaskRecord[];
  schedules: ScheduleRecord[];
};

type TrackerStore = {
  owners: OwnerRecord[];
  groups: GroupRecord[];
  tasks: TaskRecord[];
  schedules: ScheduleRecord[];
  updates: StatusUpdateRecord[];
  batches: ImportBatchRecord[];
};

declare global {
  var routinePlan69Store: TrackerStore | undefined;
}

function nowIso() {
  return new Date().toISOString();
}

function getStore() {
  globalThis.routinePlan69Store ??= {
    owners: [],
    groups: [],
    tasks: [],
    schedules: [],
    updates: [],
    batches: [],
  };

  return globalThis.routinePlan69Store;
}

function safeStatus(status: string): TaskStatus {
  return STATUSES.includes(status as TaskStatus)
    ? (status as TaskStatus)
    : "ยังไม่เริ่ม";
}

function hydrateTask(task: TaskRecord, store: TrackerStore) {
  const owner = store.owners.find((item) => item.id === task.ownerId);
  const group = store.groups.find((item) => item.id === task.groupId);

  return {
    ...task,
    ownerName: owner?.name ?? null,
    groupTitle: group?.title ?? null,
  };
}

export function actorFromRequest(request: Request) {
  return (
    request.headers.get("oai-authenticated-user-email") ??
    request.headers.get("x-user-email") ??
    "local-user"
  );
}

export async function loadTrackerData() {
  const store = getStore();

  return {
    owners: [...store.owners].sort((a, b) => a.name.localeCompare(b.name, "th")),
    groups: [...store.groups].sort((a, b) => a.sortOrder - b.sortOrder),
    tasks: [...store.tasks]
      .sort((a, b) => a.sortOrder - b.sortOrder)
      .map((task) => hydrateTask(task, store)),
    schedules: [...store.schedules],
    updates: [...store.updates].sort((a, b) => b.changedAt.localeCompare(a.changedAt)),
    batches: [...store.batches].sort((a, b) => b.importedAt.localeCompare(a.importedAt)),
    statuses: STATUSES,
  };
}

export async function replaceImport(payload: ImportPayload, actor: string) {
  const importedAt = nowIso();
  const batchId = crypto.randomUUID();
  const store = getStore();

  store.owners = payload.owners.map((owner) => ({ ...owner }));
  store.groups = payload.groups.map((group) => ({ ...group }));
  store.tasks = payload.tasks.map((task) => ({
    ...task,
    currentStatus: safeStatus(task.currentStatus),
    updatedAt: importedAt,
  }));
  store.schedules = payload.schedules.map((schedule) => ({ ...schedule }));
  store.updates = [];
  store.batches = [
    {
      id: batchId,
      fileName: payload.fileName,
      importedBy: actor,
      importedAt,
      ownerCount: payload.owners.length,
      taskCount: payload.tasks.length,
    },
  ];

  return { batchId, importedAt };
}

export async function updateTaskStatus(
  taskId: string,
  nextStatus: string,
  note: string | null,
  actor: string
) {
  const store = getStore();
  const task = store.tasks.find((item) => item.id === taskId);

  if (!task) {
    return null;
  }

  const changedAt = nowIso();
  const update: StatusUpdateRecord = {
    id: crypto.randomUUID(),
    taskId,
    previousStatus: task.currentStatus,
    nextStatus: safeStatus(nextStatus),
    note,
    changedBy: actor,
    changedAt,
  };

  task.currentStatus = update.nextStatus;
  task.note = note ?? task.note;
  task.updatedAt = changedAt;
  store.updates.unshift(update);

  return update;
}
