import { NextRequest, NextResponse } from "next/server";
import { processDueReelsServerless } from "@/lib/scheduler/publish-reels";

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
 * Serverless reel publishing tick — ping every 2–5 minutes via free cron-job.org
 * (or Vercel Cron). Runs a fast 2-step state machine (create container -> publish
 * when FINISHED) so it never exceeds Vercel Hobby's 60s timeout.
 */
export async function GET(request: NextRequest) {
  if (!isAuthorized(request)) {
    return NextResponse.json(
      { success: false, error: "Unauthorized" },
      { status: 401, headers: { "Cache-Control": "no-store, must-revalidate" } }
    );
  }

  try {
    const data = await processDueReelsServerless();
    return NextResponse.json(
      { success: true, data },
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
