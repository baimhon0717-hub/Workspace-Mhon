"use client";

import { useEffect, useMemo, useState } from "react";

const STATUSES = ["ยังไม่เริ่ม", "กำลังทำ", "เสร็จ", "ติดปัญหา"] as const;
const THAI_MONTHS = [
  "ม.ค.",
  "ก.พ.",
  "มี.ค.",
  "เม.ย.",
  "พ.ค.",
  "มิ.ย.",
  "ก.ค.",
  "ส.ค.",
  "ก.ย.",
  "ต.ค.",
  "พ.ย.",
  "ธ.ค.",
] as const;
const THAI_MONTH_NAMES: readonly string[] = THAI_MONTHS;

type Status = (typeof STATUSES)[number];

type Owner = {
  id: string;
  name: string;
};

type Task = {
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
  currentStatus: Status;
  note?: string | null;
  sortOrder: number;
  importedStatus?: string | null;
  updatedAt?: string | null;
};

type Group = {
  id: string;
  sheetName: string;
  ownerId?: string | null;
  code?: string | null;
  title: string;
  sortOrder: number;
};

type Schedule = {
  id: string;
  taskId: string;
  month?: number | null;
  day?: number | null;
  periodLabel?: string | null;
  note?: string | null;
};

type TrackerData = {
  owners: Owner[];
  groups: Group[];
  tasks: Task[];
  schedules: Schedule[];
  updates: Array<Record<string, unknown>>;
  batches: Array<Record<string, unknown>>;
};

type ImportPayload = {
  fileName: string;
  owners: Owner[];
  groups: Group[];
  tasks: Task[];
  schedules: Schedule[];
};

type View = "dashboard" | "board" | "calendar" | "import";

declare global {
  interface Window {
    XLSX?: {
      read: (data: ArrayBuffer, options: Record<string, unknown>) => WorkbookLike;
      utils: {
        sheet_to_json: (
          sheet: unknown,
          options: Record<string, unknown>
        ) => unknown[][];
      };
    };
  }
}

type WorkbookLike = {
  SheetNames: string[];
  Sheets: Record<string, unknown>;
};

const statusTone: Record<Status, string> = {
  "ยังไม่เริ่ม": "border-slate-300 bg-slate-50 text-slate-700",
  "กำลังทำ": "border-cyan-300 bg-cyan-50 text-cyan-800",
  เสร็จ: "border-emerald-300 bg-emerald-50 text-emerald-800",
  ติดปัญหา: "border-rose-300 bg-rose-50 text-rose-800",
};

function slug(input: string) {
  return input
    .trim()
    .toLowerCase()
    .replace(/\s+/g, "-")
    .replace(/[^\u0E00-\u0E7Fa-z0-9_.-]/g, "");
}

function asText(value: unknown) {
  return String(value ?? "").trim();
}

function asBool(value: unknown) {
  return value === true || value === 1 || value === "1" || value === "TRUE";
}

function statusFromCell(value: unknown): Status {
  if (value === true || value === 1 || value === "1" || value === "TRUE") {
    return "เสร็จ";
  }

  if (value === false || value === 0 || value === "0" || value === "FALSE") {
    return "ยังไม่เริ่ม";
  }

  const text = asText(value);
  return STATUSES.includes(text as Status) ? (text as Status) : "ยังไม่เริ่ม";
}

function loadSheetJs() {
  if (window.XLSX) {
    return Promise.resolve();
  }

  return new Promise<void>((resolve, reject) => {
    const existing = document.querySelector<HTMLScriptElement>(
      "script[data-sheetjs]"
    );

    if (existing) {
      existing.addEventListener("load", () => resolve());
      existing.addEventListener("error", () => reject(new Error("โหลดตัวอ่าน Excel ไม่สำเร็จ")));
      return;
    }

    const script = document.createElement("script");
    script.src = "https://cdn.sheetjs.com/xlsx-0.20.3/package/dist/xlsx.full.min.js";
    script.async = true;
    script.dataset.sheetjs = "true";
    script.onload = () => resolve();
    script.onerror = () => reject(new Error("โหลดตัวอ่าน Excel ไม่สำเร็จ"));
    document.head.appendChild(script);
  });
}

function headerIndex(headers: unknown[], needle: string) {
  return headers.findIndex((item) => asText(item).includes(needle));
}

function monthHeaderIndex(headers: unknown[]) {
  return headers.findIndex((item) => THAI_MONTH_NAMES.includes(asText(item)));
}

function ownerId(name: string) {
  return `owner-${slug(name)}`;
}

function parseWorkbook(workbook: WorkbookLike, fileName: string): ImportPayload {
  const owners = new Map<string, Owner>();
  const groups: Group[] = [];
  const tasks: Task[] = [];
  const schedules: Schedule[] = [];

  workbook.SheetNames.forEach((sheetName, sheetIndex) => {
    const sheet = workbook.Sheets[sheetName];
    const rows = window.XLSX?.utils.sheet_to_json(sheet, {
      header: 1,
      raw: true,
      defval: null,
      blankrows: false,
    }) as unknown[][];

    if (!rows?.length) {
      return;
    }

    const headers = rows[0] ?? [];
    const statusCol = headerIndex(headers, "สถานะ");
    const periodicCol = headerIndex(headers, "รายไตรมาส");
    const monthlyCol = headerIndex(headers, "รายเดือน");
    const firstDayCol = monthlyCol >= 0 ? monthlyCol + 1 : -1;
    const firstMonthCol = monthHeaderIndex(headers);
    const noteCol = headerIndex(headers, "หมายเหตุ");
    let currentOwner = "";
    let currentGroupId: string | null = null;

    rows.slice(1).forEach((row, localIndex) => {
      const sourceRow = localIndex + 2;
      const ownerName = asText(row[0]);
      const code = asText(row[1]);
      const rawTitle = asText(row[2]);

      if (ownerName) {
        currentOwner = ownerName;
        owners.set(ownerId(ownerName), { id: ownerId(ownerName), name: ownerName });
      }

      if (!rawTitle) {
        return;
      }

      const isSubtask = rawTitle.trim().startsWith("-");
      const isGroup =
        !isSubtask &&
        Boolean(code) &&
        (row[3] == null || statusCol < 0) &&
        (periodicCol < 0 || row[periodicCol] == null) &&
        (monthlyCol < 0 || row[monthlyCol] == null);

      const rowOwnerId = currentOwner ? ownerId(currentOwner) : null;

      if (isGroup) {
        currentGroupId = `group-${sheetIndex + 1}-${sourceRow}`;
        groups.push({
          id: currentGroupId,
          sheetName,
          ownerId: rowOwnerId,
          code: code || null,
          title: rawTitle,
          sortOrder: groups.length + 1,
        });
        return;
      }

      const taskId = `task-${sheetIndex + 1}-${sourceRow}`;
      const dueDays: number[] = [];
      const dueMonths: number[] = [];
      const periodNotes: string[] = [];

      if (firstDayCol > 0 && firstMonthCol > firstDayCol) {
        for (let col = firstDayCol; col < firstMonthCol; col += 1) {
          if (asBool(row[col])) {
            dueDays.push(Number(headers[col]));
          } else if (asText(row[col])) {
            periodNotes.push(asText(row[col]));
          }
        }
      }

      THAI_MONTHS.forEach((monthName, monthIndex) => {
        const startCol = headers.findIndex((item) => asText(item) === monthName);
        if (startCol < 0) {
          return;
        }

        const nextStart = headers.findIndex(
          (item, index) =>
            index > startCol && THAI_MONTH_NAMES.includes(asText(item))
        );
        const endCol = nextStart > startCol ? nextStart : noteCol > startCol ? noteCol : startCol + 4;

        for (let col = startCol; col < endCol; col += 1) {
          if (row[col] != null && asText(row[col]) !== "") {
            dueMonths.push(monthIndex + 1);
            const text = asText(row[col]);
            if (!asBool(row[col]) && text) {
              periodNotes.push(`${monthName} ${text}`);
            }
            break;
          }
        }
      });

      const periodicNote = periodicCol >= 0 ? asText(row[periodicCol + 1]) : "";
      const noteText = noteCol >= 0 ? asText(row[noteCol]) : "";
      const noteText2 = noteCol >= 0 ? asText(row[noteCol + 1]) : "";
      const scheduleNote = [
        periodicNote,
        ...periodNotes,
        noteText,
        noteText2,
      ]
        .filter(Boolean)
        .join(" | ");
      const isPeriodic = periodicCol >= 0 && asBool(row[periodicCol]);
      const isMonthly = monthlyCol >= 0 && asBool(row[monthlyCol]);
      const frequency = isMonthly
        ? "รายเดือน"
        : isPeriodic
          ? "รายไตรมาส/ครึ่งปี/ปี"
          : dueMonths.length || dueDays.length
            ? "ตามรอบเวลา"
            : "ไม่ระบุ";
      const importedStatus =
        statusCol >= 0 && row[statusCol] != null ? asText(row[statusCol]) : null;
      const task: Task = {
        id: taskId,
        groupId: currentGroupId,
        ownerId: rowOwnerId,
        sourceSheet: sheetName,
        sourceRow,
        code: code || null,
        title: rawTitle.replace(/^\s*-\s*/, "").trim(),
        detailLevel: isSubtask ? 1 : 0,
        frequency,
        scheduleNote: scheduleNote || null,
        dueDay: dueDays[0] ?? null,
        dueMonth: dueMonths[0] ?? null,
        currentStatus: statusCol >= 0 ? statusFromCell(row[statusCol]) : "ยังไม่เริ่ม",
        note: noteText || noteText2 || null,
        sortOrder: tasks.length + 1,
        importedStatus,
      };

      tasks.push(task);

      if (!dueDays.length && !dueMonths.length && scheduleNote) {
        schedules.push({
          id: `schedule-${taskId}-note`,
          taskId,
          periodLabel: scheduleNote,
        });
      }

      dueMonths.forEach((month) => {
        schedules.push({
          id: `schedule-${taskId}-m${month}`,
          taskId,
          month,
          day: dueDays[0] ?? null,
          periodLabel: THAI_MONTHS[month - 1],
          note: scheduleNote || null,
        });
      });

      if (!dueMonths.length) {
        dueDays.forEach((day) => {
          schedules.push({
            id: `schedule-${taskId}-d${day}`,
            taskId,
            day,
            periodLabel: `วันที่ ${day}`,
            note: scheduleNote || null,
          });
        });
      }
    });
  });

  return {
    fileName,
    owners: Array.from(owners.values()),
    groups,
    tasks,
    schedules,
  };
}

function taskDateLabel(task: Task) {
  const month = task.dueMonth ? THAI_MONTHS[task.dueMonth - 1] : "";
  const day = task.dueDay ? `วันที่ ${task.dueDay}` : "";
  return [month, day].filter(Boolean).join(" ");
}

function isOverdue(task: Task, selectedMonth: number) {
  if (task.currentStatus === "เสร็จ" || task.currentStatus === "ติดปัญหา") {
    return false;
  }

  if (!task.dueDay) {
    return false;
  }

  const today = new Date();
  const thaiMonth = today.getMonth() + 1;
  if ((task.dueMonth ?? selectedMonth) !== thaiMonth) {
    return false;
  }

  return task.dueDay < today.getDate();
}

export default function TrackerClient({ displayName }: { displayName: string }) {
  const [data, setData] = useState<TrackerData>({
    owners: [],
    groups: [],
    tasks: [],
    schedules: [],
    updates: [],
    batches: [],
  });
  const [view, setView] = useState<View>("dashboard");
  const [ownerFilter, setOwnerFilter] = useState("all");
  const [monthFilter, setMonthFilter] = useState(new Date().getMonth() + 1);
  const [statusFilter, setStatusFilter] = useState("all");
  const [groupFilter, setGroupFilter] = useState("all");
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const [importPreview, setImportPreview] = useState<ImportPayload | null>(null);

  async function refresh() {
    const response = await fetch("/api/tasks", { cache: "no-store" });
    const next = await response.json();
    if (!response.ok) {
      throw new Error(next.error ?? "โหลดข้อมูลไม่สำเร็จ");
    }
    setData(next);
  }

  useEffect(() => {
    refresh().catch((error) => setMessage(error.message));
  }, []);

  const filteredTasks = useMemo(() => {
    return data.tasks.filter((task) => {
      const ownerMatch = ownerFilter === "all" || task.ownerId === ownerFilter;
      const statusMatch = statusFilter === "all" || task.currentStatus === statusFilter;
      const groupMatch = groupFilter === "all" || task.groupId === groupFilter;
      const monthMatch =
        !task.dueMonth || task.dueMonth === monthFilter || task.frequency === "รายเดือน";
      return ownerMatch && statusMatch && groupMatch && monthMatch;
    });
  }, [data.tasks, groupFilter, monthFilter, ownerFilter, statusFilter]);

  const kpis = useMemo(() => {
    const total = filteredTasks.length;
    const done = filteredTasks.filter((task) => task.currentStatus === "เสร็จ").length;
    const blocked = filteredTasks.filter((task) => task.currentStatus === "ติดปัญหา").length;
    const overdue = filteredTasks.filter((task) => isOverdue(task, monthFilter)).length;
    return { total, done, blocked, overdue };
  }, [filteredTasks, monthFilter]);

  async function handleFile(file: File) {
    setBusy(true);
    setMessage("กำลังอ่านไฟล์ Excel");
    try {
      await loadSheetJs();
      const workbook = window.XLSX?.read(await file.arrayBuffer(), {
        type: "array",
        cellDates: false,
      });

      if (!workbook) {
        throw new Error("อ่านไฟล์ไม่สำเร็จ");
      }

      const payload = parseWorkbook(workbook, file.name);
      setImportPreview(payload);
      setMessage(`อ่านข้อมูลแล้ว: ${payload.tasks.length} งาน, ${payload.owners.length} เจ้าของงาน`);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "อ่านไฟล์ไม่สำเร็จ");
    } finally {
      setBusy(false);
    }
  }

  async function confirmImport() {
    if (!importPreview) {
      return;
    }

    setBusy(true);
    setMessage("กำลังบันทึกข้อมูลนำเข้า");
    try {
      const response = await fetch("/api/import", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(importPreview),
      });
      const result = await response.json();
      if (!response.ok) {
        throw new Error(result.error ?? "นำเข้าไม่สำเร็จ");
      }
      setImportPreview(null);
      await refresh();
      setView("dashboard");
      setMessage(`นำเข้าสำเร็จ ${result.taskCount} งาน`);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "นำเข้าไม่สำเร็จ");
    } finally {
      setBusy(false);
    }
  }

  async function changeStatus(task: Task, status: Status) {
    if (task.currentStatus === status) {
      return;
    }

    setBusy(true);
    try {
      const response = await fetch(`/api/tasks/${task.id}/status`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ status }),
      });
      const result = await response.json();
      if (!response.ok) {
        throw new Error(result.error ?? "เปลี่ยนสถานะไม่สำเร็จ");
      }
      setData((current) => ({
        ...current,
        tasks: current.tasks.map((item) =>
          item.id === task.id ? { ...item, currentStatus: status } : item
        ),
      }));
      setMessage(`อัปเดต "${task.title}" เป็น ${status}`);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "เปลี่ยนสถานะไม่สำเร็จ");
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="min-h-screen bg-[#f8fafc] text-slate-950">
      <div className="border-b border-slate-200 bg-white">
        <div className="mx-auto flex max-w-7xl flex-col gap-4 px-4 py-4 lg:px-6">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <p className="text-sm text-slate-500">Routine Plan69</p>
              <h1 className="text-2xl font-semibold tracking-normal text-slate-950">
                ระบบติดตามงานประจำทีม
              </h1>
            </div>
            <div className="flex flex-wrap items-center gap-2 text-sm">
              <span className="rounded-md border border-slate-200 bg-slate-50 px-3 py-2 text-slate-600">
                ผู้ใช้: {displayName}
              </span>
              <a
                className="rounded-md bg-cyan-700 px-3 py-2 font-medium text-white hover:bg-cyan-800"
                href="/api/export"
              >
                ส่งออก Excel
              </a>
            </div>
          </div>

          <div className="flex flex-wrap gap-2">
            {[
              ["dashboard", "Dashboard"],
              ["board", "Board"],
              ["calendar", "Calendar"],
              ["import", "Import"],
            ].map(([key, label]) => (
              <button
                className={`rounded-md border px-3 py-2 text-sm font-medium ${
                  view === key
                    ? "border-cyan-700 bg-cyan-700 text-white"
                    : "border-slate-200 bg-white text-slate-700 hover:bg-slate-50"
                }`}
                key={key}
                onClick={() => setView(key as View)}
                type="button"
              >
                {label}
              </button>
            ))}
          </div>

          <div className="grid gap-2 md:grid-cols-4">
            <select
              className="rounded-md border border-slate-300 bg-white px-3 py-2 text-sm"
              onChange={(event) => setOwnerFilter(event.target.value)}
              value={ownerFilter}
            >
              <option value="all">เจ้าของงานทั้งหมด</option>
              {data.owners.map((owner) => (
                <option key={owner.id} value={owner.id}>
                  {owner.name}
                </option>
              ))}
            </select>
            <select
              className="rounded-md border border-slate-300 bg-white px-3 py-2 text-sm"
              onChange={(event) => setMonthFilter(Number(event.target.value))}
              value={monthFilter}
            >
              {THAI_MONTHS.map((month, index) => (
                <option key={month} value={index + 1}>
                  {month}
                </option>
              ))}
            </select>
            <select
              className="rounded-md border border-slate-300 bg-white px-3 py-2 text-sm"
              onChange={(event) => setStatusFilter(event.target.value)}
              value={statusFilter}
            >
              <option value="all">สถานะทั้งหมด</option>
              {STATUSES.map((status) => (
                <option key={status} value={status}>
                  {status}
                </option>
              ))}
            </select>
            <select
              className="rounded-md border border-slate-300 bg-white px-3 py-2 text-sm"
              onChange={(event) => setGroupFilter(event.target.value)}
              value={groupFilter}
            >
              <option value="all">หมวดงานทั้งหมด</option>
              {data.groups.map((group) => (
                <option key={group.id} value={group.id}>
                  {group.title}
                </option>
              ))}
            </select>
          </div>

          {message && (
            <p className="rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900">
              {message}
            </p>
          )}
        </div>
      </div>

      <div className="mx-auto max-w-7xl px-4 py-5 lg:px-6">
        {view === "dashboard" && (
          <Dashboard
            busy={busy}
            kpis={kpis}
            month={monthFilter}
            tasks={filteredTasks}
            onStatusChange={changeStatus}
          />
        )}
        {view === "board" && (
          <Board busy={busy} tasks={filteredTasks} onStatusChange={changeStatus} />
        )}
        {view === "calendar" && (
          <CalendarView
            busy={busy}
            month={monthFilter}
            tasks={filteredTasks}
            onStatusChange={changeStatus}
          />
        )}
        {view === "import" && (
          <ImportView
            busy={busy}
            preview={importPreview}
            onConfirm={confirmImport}
            onFile={handleFile}
          />
        )}
      </div>
    </main>
  );
}

function Dashboard({
  busy,
  kpis,
  month,
  tasks,
  onStatusChange,
}: {
  busy: boolean;
  kpis: { total: number; done: number; blocked: number; overdue: number };
  month: number;
  tasks: Task[];
  onStatusChange: (task: Task, status: Status) => void;
}) {
  const activeTasks = tasks
    .filter((task) => task.currentStatus !== "เสร็จ")
    .slice(0, 12);

  return (
    <div className="space-y-5">
      <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Kpi label="งานในมุมมองนี้" value={kpis.total} />
        <Kpi label="เสร็จแล้ว" value={kpis.done} tone="text-emerald-700" />
        <Kpi label="เกินกำหนด" value={kpis.overdue} tone="text-rose-700" />
        <Kpi label="ติดปัญหา" value={kpis.blocked} tone="text-amber-700" />
      </section>

      <section className="rounded-lg border border-slate-200 bg-white">
        <div className="border-b border-slate-200 px-4 py-3">
          <h2 className="font-semibold">งานที่ต้องติดตามในเดือน {THAI_MONTHS[month - 1]}</h2>
        </div>
        <TaskTable busy={busy} tasks={activeTasks} onStatusChange={onStatusChange} />
      </section>
    </div>
  );
}

function Kpi({
  label,
  value,
  tone = "text-slate-950",
}: {
  label: string;
  value: number;
  tone?: string;
}) {
  return (
    <article className="rounded-lg border border-slate-200 bg-white p-4">
      <p className="text-sm text-slate-500">{label}</p>
      <p className={`mt-2 text-3xl font-semibold ${tone}`}>{value}</p>
    </article>
  );
}

function Board({
  busy,
  tasks,
  onStatusChange,
}: {
  busy: boolean;
  tasks: Task[];
  onStatusChange: (task: Task, status: Status) => void;
}) {
  return (
    <section className="grid gap-3 lg:grid-cols-4">
      {STATUSES.map((status) => (
        <div className="rounded-lg border border-slate-200 bg-white" key={status}>
          <div className={`border-b px-3 py-3 ${statusTone[status]}`}>
            <h2 className="font-semibold">{status}</h2>
            <p className="text-sm">{tasks.filter((task) => task.currentStatus === status).length} งาน</p>
          </div>
          <div className="space-y-3 p-3">
            {tasks
              .filter((task) => task.currentStatus === status)
              .map((task) => (
                <TaskCard
                  busy={busy}
                  key={task.id}
                  task={task}
                  onStatusChange={onStatusChange}
                />
              ))}
          </div>
        </div>
      ))}
    </section>
  );
}

function CalendarView({
  busy,
  month,
  tasks,
  onStatusChange,
}: {
  busy: boolean;
  month: number;
  tasks: Task[];
  onStatusChange: (task: Task, status: Status) => void;
}) {
  const days = Array.from({ length: 31 }, (_, index) => index + 1);
  const timedTasks = tasks.filter((task) => task.dueDay);
  const periodTasks = tasks.filter((task) => !task.dueDay && task.scheduleNote);

  return (
    <div className="space-y-5">
      <section className="grid gap-2 sm:grid-cols-2 lg:grid-cols-7">
        {days.map((day) => {
          const dayTasks = timedTasks.filter(
            (task) => task.dueDay === day && (!task.dueMonth || task.dueMonth === month)
          );
          return (
            <div className="min-h-32 rounded-lg border border-slate-200 bg-white p-2" key={day}>
              <div className="mb-2 flex items-center justify-between">
                <span className="text-sm font-semibold">วันที่ {day}</span>
                <span className="text-xs text-slate-500">{dayTasks.length}</span>
              </div>
              <div className="space-y-2">
                {dayTasks.slice(0, 3).map((task) => (
                  <TaskMini
                    busy={busy}
                    key={task.id}
                    task={task}
                    onStatusChange={onStatusChange}
                  />
                ))}
              </div>
            </div>
          );
        })}
      </section>

      <section className="rounded-lg border border-slate-200 bg-white">
        <div className="border-b border-slate-200 px-4 py-3">
          <h2 className="font-semibold">งานรอบเวลาและงานที่ไม่มีวันที่แน่นอน</h2>
        </div>
        <TaskTable busy={busy} tasks={periodTasks} onStatusChange={onStatusChange} />
      </section>
    </div>
  );
}

function ImportView({
  busy,
  preview,
  onConfirm,
  onFile,
}: {
  busy: boolean;
  preview: ImportPayload | null;
  onConfirm: () => void;
  onFile: (file: File) => void;
}) {
  const completed = preview?.tasks.filter((task) => task.currentStatus === "เสร็จ").length ?? 0;

  return (
    <div className="grid gap-5 lg:grid-cols-[360px_1fr]">
      <section className="rounded-lg border border-slate-200 bg-white p-4">
        <h2 className="font-semibold">นำเข้าไฟล์ Routine Plan69</h2>
        <input
          accept=".xlsx,.xls"
          className="mt-4 block w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm"
          disabled={busy}
          onChange={(event) => {
            const file = event.target.files?.[0];
            if (file) {
              onFile(file);
            }
          }}
          type="file"
        />
        <button
          className="mt-4 w-full rounded-md bg-cyan-700 px-3 py-2 text-sm font-medium text-white disabled:cursor-not-allowed disabled:bg-slate-300"
          disabled={busy || !preview}
          onClick={onConfirm}
          type="button"
        >
          ยืนยันนำเข้า
        </button>
      </section>

      <section className="rounded-lg border border-slate-200 bg-white">
        <div className="border-b border-slate-200 px-4 py-3">
          <h2 className="font-semibold">Preview</h2>
        </div>
        {preview ? (
          <div className="space-y-4 p-4">
            <div className="grid gap-3 sm:grid-cols-4">
              <PreviewStat label="เจ้าของงาน" value={preview.owners.length} />
              <PreviewStat label="หมวดงาน" value={preview.groups.length} />
              <PreviewStat label="งานทั้งหมด" value={preview.tasks.length} />
              <PreviewStat label="เสร็จจากไฟล์เดิม" value={completed} />
            </div>
            <TaskTable busy={busy} tasks={preview.tasks.slice(0, 15)} />
          </div>
        ) : (
          <p className="p-4 text-sm text-slate-500">ยังไม่มีไฟล์ที่อ่านแล้ว</p>
        )}
      </section>
    </div>
  );
}

function TaskTable({
  busy,
  tasks,
  onStatusChange,
}: {
  busy: boolean;
  tasks: Task[];
  onStatusChange?: (task: Task, status: Status) => void;
}) {
  if (!tasks.length) {
    return <p className="px-4 py-8 text-sm text-slate-500">ไม่พบงานในมุมมองนี้</p>;
  }

  return (
    <div className="overflow-x-auto">
      <table className="min-w-full text-left text-sm">
        <thead className="bg-slate-100 text-slate-600">
          <tr>
            <th className="px-4 py-3">งาน</th>
            <th className="px-4 py-3">เจ้าของ</th>
            <th className="px-4 py-3">รอบงาน</th>
            <th className="px-4 py-3">กำหนด</th>
            <th className="px-4 py-3">สถานะ</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100">
          {tasks.map((task) => (
            <tr key={task.id}>
              <td className="max-w-md px-4 py-3">
                <p className="font-medium text-slate-900">{task.title}</p>
                <p className="text-xs text-slate-500">{task.groupTitle ?? task.sourceSheet}</p>
              </td>
              <td className="px-4 py-3 text-slate-700">{task.ownerName ?? "-"}</td>
              <td className="px-4 py-3 text-slate-700">{task.frequency}</td>
              <td className="px-4 py-3 text-slate-700">
                {taskDateLabel(task) || task.scheduleNote || "-"}
              </td>
              <td className="px-4 py-3">
                {onStatusChange ? (
                  <StatusSelect
                    busy={busy}
                    status={task.currentStatus}
                    onChange={(status) => onStatusChange(task, status)}
                  />
                ) : (
                  <StatusPill status={task.currentStatus} />
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function TaskCard({
  busy,
  task,
  onStatusChange,
}: {
  busy: boolean;
  task: Task;
  onStatusChange: (task: Task, status: Status) => void;
}) {
  return (
    <article className="rounded-lg border border-slate-200 bg-white p-3 shadow-sm">
      <p className="text-sm font-medium text-slate-900">{task.title}</p>
      <p className="mt-1 text-xs text-slate-500">{task.ownerName ?? "-"} · {task.frequency}</p>
      <p className="mt-2 text-xs text-slate-600">{taskDateLabel(task) || task.scheduleNote || "ไม่ระบุกำหนด"}</p>
      <div className="mt-3">
        <StatusSelect
          busy={busy}
          status={task.currentStatus}
          onChange={(status) => onStatusChange(task, status)}
        />
      </div>
    </article>
  );
}

function TaskMini({
  busy,
  task,
  onStatusChange,
}: {
  busy: boolean;
  task: Task;
  onStatusChange: (task: Task, status: Status) => void;
}) {
  return (
    <div className="rounded-md border border-slate-200 bg-slate-50 p-2">
      <p className="max-h-9 overflow-hidden text-xs font-medium text-slate-800">{task.title}</p>
      <div className="mt-2">
        <StatusSelect
          busy={busy}
          status={task.currentStatus}
          onChange={(status) => onStatusChange(task, status)}
        />
      </div>
    </div>
  );
}

function StatusSelect({
  busy,
  status,
  onChange,
}: {
  busy: boolean;
  status: Status;
  onChange: (status: Status) => void;
}) {
  return (
    <select
      className={`w-full rounded-md border px-2 py-1 text-xs font-medium ${statusTone[status]}`}
      disabled={busy}
      onChange={(event) => onChange(event.target.value as Status)}
      value={status}
    >
      {STATUSES.map((item) => (
        <option key={item} value={item}>
          {item}
        </option>
      ))}
    </select>
  );
}

function StatusPill({ status }: { status: Status }) {
  return (
    <span className={`inline-flex rounded-md border px-2 py-1 text-xs font-medium ${statusTone[status]}`}>
      {status}
    </span>
  );
}

function PreviewStat({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-md border border-slate-200 bg-slate-50 px-3 py-2">
      <p className="text-xs text-slate-500">{label}</p>
      <p className="mt-1 text-xl font-semibold text-slate-900">{value}</p>
    </div>
  );
}
