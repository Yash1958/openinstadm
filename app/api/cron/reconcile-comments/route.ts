import { NextRequest, NextResponse } from "next/server";
import { reconcileComments } from "@/lib/polling/comment-reconciler";

export const maxDuration = 60;

function isAuthorized(request: NextRequest): boolean {
  const cronSecret = process.env.CRON_SECRET || process.env.NEXTAUTH_SECRET;
  if (!cronSecret) return false;
  const authHeader = request.headers.get("authorization");
  if (authHeader === `Bearer ${cronSecret}`) return true;
  const querySecret = request.nextUrl.searchParams.get("secret");
  return querySecret === cronSecret;
}

/**
 * Optional serverless comment-polling safety net — ping every 30–60 minutes
 * via free cron-job.org to catch any comments Meta's webhooks missed.
 */
export async function GET(request: NextRequest) {
  if (!isAuthorized(request)) {
    return NextResponse.json(
      { success: false, error: "Unauthorized" },
      { status: 401, headers: { "Cache-Control": "no-store, must-revalidate" } }
    );
  }

  try {
    await reconcileComments();
    return NextResponse.json(
      { success: true },
      { headers: { "Cache-Control": "no-store, must-revalidate" } }
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json(
      { success: false, error: message },
      { status: 500, headers: { "Cache-Control": "no-store, must-revalidate" } }
    );
  }
}
