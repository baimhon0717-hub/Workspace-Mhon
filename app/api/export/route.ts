import { loadTrackerData } from "@/db/store";

function cell(value: unknown) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

export async function GET() {
  try {
    const data = await loadTrackerData();
    const tasks = data.tasks as Array<Record<string, unknown>>;
    const generatedAt = new Date().toLocaleString("th-TH", {
      timeZone: "Asia/Bangkok",
      dateStyle: "medium",
      timeStyle: "short",
    });

    const rows = tasks
      .map(
        (task) => `<tr>
          <td>${cell(task.sourceSheet)}</td>
          <td>${cell(task.ownerName)}</td>
          <td>${cell(task.groupTitle)}</td>
          <td>${cell(task.code)}</td>
          <td>${cell(task.title)}</td>
          <td>${cell(task.frequency)}</td>
          <td>${cell(task.dueMonth)}</td>
          <td>${cell(task.dueDay)}</td>
          <td>${cell(task.scheduleNote)}</td>
          <td>${cell(task.currentStatus)}</td>
          <td>${cell(task.note)}</td>
          <td>${cell(task.updatedAt)}</td>
        </tr>`
      )
      .join("");

    const html = `<!doctype html>
      <html>
        <head>
          <meta charset="utf-8" />
          <style>
            body { font-family: Tahoma, Arial, sans-serif; }
            table { border-collapse: collapse; width: 100%; }
            th { background: #155e75; color: #ffffff; font-weight: 700; }
            th, td { border: 1px solid #cbd5e1; padding: 8px; vertical-align: top; }
          </style>
        </head>
        <body>
          <h1>รายงานติดตามงาน Routine Plan69</h1>
          <p>สร้างเมื่อ ${cell(generatedAt)}</p>
          <table>
            <thead>
              <tr>
                <th>ชีต</th>
                <th>เจ้าของงาน</th>
                <th>หมวดงาน</th>
                <th>ลำดับ</th>
                <th>งาน</th>
                <th>รอบงาน</th>
                <th>เดือน</th>
                <th>วันที่</th>
                <th>กำหนดส่ง/หมายกำหนดการ</th>
                <th>สถานะ</th>
                <th>หมายเหตุ</th>
                <th>แก้ไขล่าสุด</th>
              </tr>
            </thead>
            <tbody>${rows}</tbody>
          </table>
        </body>
      </html>`;

    return new Response(`\uFEFF${html}`, {
      headers: {
        "content-type": "application/vnd.ms-excel; charset=utf-8",
        "content-disposition": 'attachment; filename="routine-plan69-status.xls"',
      },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unexpected error";
    return Response.json({ error: message }, { status: 500 });
  }
}
