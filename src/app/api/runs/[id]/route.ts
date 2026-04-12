import { NextResponse } from "next/server";
import { getRunDetail } from "@/lib/health-check-service";

export const runtime = "nodejs";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params;
    const detail = await getRunDetail(id);
    if (!detail) {
      return NextResponse.json({ error: "Run not found" }, { status: 404 });
    }
    return NextResponse.json(detail);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to load run detail";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
