import { NextResponse } from "next/server";
import { getAlertsPayload } from "@/lib/alert-service";

export const runtime = "nodejs";

export async function GET() {
  try {
    const payload = await getAlertsPayload();
    return NextResponse.json(payload);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to load alerts";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
