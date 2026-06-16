import { actorFromRequest, updateTaskStatus } from "@/db/store";

export async function PATCH(
  request: Request,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await context.params;
    const payload = (await request.json()) as {
      status?: string;
      note?: string | null;
    };

    if (!payload.status) {
      return Response.json({ error: "กรุณาระบุสถานะ" }, { status: 400 });
    }

    const update = await updateTaskStatus(
      id,
      payload.status,
      payload.note ?? null,
      actorFromRequest(request)
    );

    if (!update) {
      return Response.json({ error: "ไม่พบงานนี้" }, { status: 404 });
    }

    return Response.json({ update });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unexpected error";
    return Response.json({ error: message }, { status: 500 });
  }
}
