import { loadTrackerData } from "@/db/store";

export async function GET() {
  try {
    return Response.json(await loadTrackerData());
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unexpected error";
    return Response.json({ error: message }, { status: 500 });
  }
}
