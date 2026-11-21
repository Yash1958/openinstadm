import { NextResponse } from "next/server";
import { listReelObjects } from "@/lib/storage/r2";
import {
  canManageCampaigns,
  getCurrentWorkspaceContext,
} from "@/lib/workspace-access";

export async function GET() {
  const context = await getCurrentWorkspaceContext();
  if (!context) {
    return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
  }
  if (!canManageCampaigns(context)) {
    return NextResponse.json({ success: false, error: "Forbidden" }, { status: 403 });
  }
  try {
    const files = await listReelObjects();
    return NextResponse.json(
      { success: true, data: files },
      { headers: { "Cache-Control": "no-store" } }
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : "Could not read the video bucket";
    return NextResponse.json({ success: false, error: message }, { status: 502 });
  }
}
