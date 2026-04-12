import { NextRequest, NextResponse } from "next/server";
import { startRun, getRunHistory } from "@/lib/health-check-service";

export const runtime = "nodejs";

export async function GET(request: NextRequest) {
  try {
    const limit = Number(request.nextUrl.searchParams.get("limit") || 50);
    const offset = Number(request.nextUrl.searchParams.get("offset") || 0);
    const result = await getRunHistory(limit, offset);
    return NextResponse.json(result);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to load run history";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function POST() {
  try {
    const result = await startRun();
    return NextResponse.json(result, { status: result.alreadyRunning ? 200 : 201 });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to start health check";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
