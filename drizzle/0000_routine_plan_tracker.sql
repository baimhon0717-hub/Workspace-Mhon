CREATE TABLE `owners` (
  `id` text PRIMARY KEY NOT NULL,
  `name` text NOT NULL,
  `email` text,
  `created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `owners_name_unique` ON `owners` (`name`);
--> statement-breakpoint
CREATE TABLE `task_groups` (
  `id` text PRIMARY KEY NOT NULL,
  `sheet_name` text NOT NULL,
  `owner_id` text,
  `code` text,
  `title` text NOT NULL,
  `sort_order` integer NOT NULL,
  `created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE TABLE `tasks` (
  `id` text PRIMARY KEY NOT NULL,
  `group_id` text,
  `owner_id` text,
  `source_sheet` text NOT NULL,
  `source_row` integer NOT NULL,
  `code` text,
  `title` text NOT NULL,
  `detail_level` integer DEFAULT 0 NOT NULL,
  `frequency` text DEFAULT 'ไม่ระบุ' NOT NULL,
  `schedule_note` text,
  `due_day` integer,
  `due_month` integer,
  `current_status` text DEFAULT 'ยังไม่เริ่ม' NOT NULL,
  `note` text,
  `sort_order` integer NOT NULL,
  `imported_status` text,
  `created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
  `updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE TABLE `task_schedules` (
  `id` text PRIMARY KEY NOT NULL,
  `task_id` text NOT NULL,
  `month` integer,
  `day` integer,
  `period_label` text,
  `note` text
);
--> statement-breakpoint
CREATE TABLE `status_updates` (
  `id` text PRIMARY KEY NOT NULL,
  `task_id` text NOT NULL,
  `previous_status` text,
  `next_status` text NOT NULL,
  `note` text,
  `changed_by` text,
  `changed_at` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `activity_log` (
  `id` text PRIMARY KEY NOT NULL,
  `action` text NOT NULL,
  `entity_type` text NOT NULL,
  `entity_id` text,
  `detail` text,
  `actor_email` text,
  `created_at` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `import_batches` (
  `id` text PRIMARY KEY NOT NULL,
  `file_name` text NOT NULL,
  `imported_by` text,
  `imported_at` text NOT NULL,
  `owner_count` integer NOT NULL,
  `task_count` integer NOT NULL
);
--> statement-breakpoint
CREATE INDEX `tasks_owner_idx` ON `tasks` (`owner_id`);
--> statement-breakpoint
CREATE INDEX `tasks_group_idx` ON `tasks` (`group_id`);
--> statement-breakpoint
CREATE INDEX `tasks_status_idx` ON `tasks` (`current_status`);
--> statement-breakpoint
CREATE INDEX `task_schedules_task_idx` ON `task_schedules` (`task_id`);
