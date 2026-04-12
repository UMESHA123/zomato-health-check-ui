import { NextRequest, NextResponse } from "next/server";
import { getDashboardPayload } from "@/lib/health-check-service";

export const runtime = "nodejs";

export async function GET(request: NextRequest) {
  try {
    const runId = request.nextUrl.searchParams.get("runId") || undefined;
    const payload = await getDashboardPayload(runId);
    return NextResponse.json(payload);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to load dashboard data";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
