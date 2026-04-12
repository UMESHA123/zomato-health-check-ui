import { NextRequest, NextResponse } from "next/server";
import { toggleAlertRule, acknowledgeAlert, resolveAlert } from "@/lib/alert-service";

export const runtime = "nodejs";

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params;
    const body = await request.json();
    const numId = Number(id);

    if (body.action === "toggle") {
      await toggleAlertRule(numId, body.enabled);
      return NextResponse.json({ success: true });
    }

    if (body.action === "acknowledge") {
      await acknowledgeAlert(numId);
      return NextResponse.json({ success: true });
    }

    if (body.action === "resolve") {
      await resolveAlert(numId);
      return NextResponse.json({ success: true });
    }

    return NextResponse.json({ error: "Invalid action" }, { status: 400 });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to update alert";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
