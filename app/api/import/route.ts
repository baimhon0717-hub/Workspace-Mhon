import { actorFromRequest, replaceImport, type ImportPayload } from "@/db/store";

export async function POST(request: Request) {
  try {
    const payload = (await request.json()) as ImportPayload;

    if (!payload.fileName || !Array.isArray(payload.tasks)) {
      return Response.json({ error: "ข้อมูลนำเข้าไม่ครบถ้วน" }, { status: 400 });
    }

    const result = await replaceImport(payload, actorFromRequest(request));
    return Response.json({
      ...result,
      ownerCount: payload.owners.length,
      taskCount: payload.tasks.length,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unexpected error";
    return Response.json({ error: message }, { status: 500 });
  }
}
