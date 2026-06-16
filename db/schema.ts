import { integer, sqliteTable, text } from "drizzle-orm/sqlite-core";

export const owners = sqliteTable("owners", {
  id: text("id").primaryKey(),
  name: text("name").notNull().unique(),
  email: text("email"),
  createdAt: text("created_at").notNull().default("CURRENT_TIMESTAMP"),
});

export const taskGroups = sqliteTable("task_groups", {
  id: text("id").primaryKey(),
  sheetName: text("sheet_name").notNull(),
  ownerId: text("owner_id"),
  code: text("code"),
  title: text("title").notNull(),
  sortOrder: integer("sort_order").notNull(),
  createdAt: text("created_at").notNull().default("CURRENT_TIMESTAMP"),
});

export const tasks = sqliteTable("tasks", {
  id: text("id").primaryKey(),
  groupId: text("group_id"),
  ownerId: text("owner_id"),
  sourceSheet: text("source_sheet").notNull(),
  sourceRow: integer("source_row").notNull(),
  code: text("code"),
  title: text("title").notNull(),
  detailLevel: integer("detail_level").notNull().default(0),
  frequency: text("frequency").notNull().default("ไม่ระบุ"),
  scheduleNote: text("schedule_note"),
  dueDay: integer("due_day"),
  dueMonth: integer("due_month"),
  currentStatus: text("current_status").notNull().default("ยังไม่เริ่ม"),
  note: text("note"),
  sortOrder: integer("sort_order").notNull(),
  importedStatus: text("imported_status"),
  createdAt: text("created_at").notNull().default("CURRENT_TIMESTAMP"),
  updatedAt: text("updated_at").notNull().default("CURRENT_TIMESTAMP"),
});

export const taskSchedules = sqliteTable("task_schedules", {
  id: text("id").primaryKey(),
  taskId: text("task_id").notNull(),
  month: integer("month"),
  day: integer("day"),
  periodLabel: text("period_label"),
  note: text("note"),
});

export const statusUpdates = sqliteTable("status_updates", {
  id: text("id").primaryKey(),
  taskId: text("task_id").notNull(),
  previousStatus: text("previous_status"),
  nextStatus: text("next_status").notNull(),
  note: text("note"),
  changedBy: text("changed_by"),
  changedAt: text("changed_at").notNull(),
});

export const activityLog = sqliteTable("activity_log", {
  id: text("id").primaryKey(),
  action: text("action").notNull(),
  entityType: text("entity_type").notNull(),
  entityId: text("entity_id"),
  detail: text("detail"),
  actorEmail: text("actor_email"),
  createdAt: text("created_at").notNull(),
});

export const importBatches = sqliteTable("import_batches", {
  id: text("id").primaryKey(),
  fileName: text("file_name").notNull(),
  importedBy: text("imported_by"),
  importedAt: text("imported_at").notNull(),
  ownerCount: integer("owner_count").notNull(),
  taskCount: integer("task_count").notNull(),
});
