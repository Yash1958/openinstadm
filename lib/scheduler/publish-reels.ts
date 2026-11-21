import { prisma } from "@/lib/db/client";
import { decryptToken } from "@/lib/meta/oauth";
import {
  createReelContainer,
  getMediaPermalink,
  publishContainer,
  waitForContainerReady,
} from "@/lib/meta/publish";
import { deleteReelObject, getSignedReelUrl } from "@/lib/storage/r2";
import { generateReportShareSlug } from "@/lib/reports/share";
import { generateTrackedLinkSlug } from "@/lib/tracking/server";
import { invalidateCampaignsCache } from "@/lib/server/automations";
import { invalidateWorkspaceStats } from "@/lib/server/stats";

// A reel that has sat in PUBLISHING longer than this was interrupted (worker
// restart, crash). We never retry it automatically: the video may already be
// live, and posting twice is worse than asking a human to look.
const STUCK_AFTER_MS = 30 * 60_000;
const MAX_DUE_PER_RUN = 3;

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : "Unknown error";
}

/** Marks reels interrupted mid-publish as FAILED so nobody double-posts. */
export async function failStuckReels(now = new Date()): Promise<number> {
  const cutoff = new Date(now.getTime() - STUCK_AFTER_MS);
  const result = await prisma.scheduledReel.updateMany({
    where: { status: "PUBLISHING", updatedAt: { lt: cutoff } },
    data: {
      status: "FAILED",
      error:
        "Interrupted while publishing. Check Instagram to see whether it went live before retrying.",
    },
  });
  return result.count;
}

/** Creates the comment-to-DM campaign on the media id Instagram just returned. */
async function createCampaignForReel(
  reel: {
    id: string;
    workspaceId: string;
    instagramAccountId: string;
    name: string;
    keyword: string;
    dmMessage: string;
    destinationUrl: string;
    linkButtonLabel: string;
  },
  mediaId: string,
  permalink: string | null
): Promise<string> {
  const automation = await prisma.automation.create({
    data: {
      name: reel.name,
      postId: mediaId,
      postUrl: permalink,
      pendingNextReel: false,
      matchAnyPost: false,
      keywords: [reel.keyword],
      matchAnyWord: false,
      dmMessage: reel.dmMessage,
      linkButtonLabel: reel.linkButtonLabel,
      isActive: true,
      wholeWordMatch: true,
      workspaceId: reel.workspaceId,
      instagramAccountId: reel.instagramAccountId,
      reportShareSlug: generateReportShareSlug(),
      trackedLinks: {
        create: [
          {
            workspaceId: reel.workspaceId,
            slug: generateTrackedLinkSlug(),
            label: "Primary campaign link",
            destinationUrl: reel.destinationUrl,
          },
        ],
      },
    },
    select: { id: true },
  });
  invalidateWorkspaceStats(reel.workspaceId);
  invalidateCampaignsCache(reel.workspaceId);
  return automation.id;
}

/** Publishes one claimed reel end to end. Never throws; records failures on the row. */
export async function publishScheduledReel(reelId: string): Promise<"published" | "failed" | "skipped"> {
  // Claim atomically so two workers can never publish the same reel.
  const claimed = await prisma.scheduledReel.updateMany({
    where: { id: reelId, status: "SCHEDULED" },
    data: { status: "PUBLISHING", attempts: { increment: 1 }, error: null },
  });
  if (claimed.count === 0) return "skipped";

  const reel = await prisma.scheduledReel.findUniqueOrThrow({
    where: { id: reelId },
    include: { instagramAccount: true },
  });

  try {
    const token = decryptToken(reel.instagramAccount.accessToken);

    const videoUrl = await getSignedReelUrl(reel.r2Key);
    const containerId = await createReelContainer({
      accessToken: token,
      videoUrl,
      caption: reel.caption,
    });
    await prisma.scheduledReel.update({
      where: { id: reel.id },
      data: { containerId },
    });

    await waitForContainerReady(token, containerId);
    const mediaId = await publishContainer(token, containerId);
    // From here on the reel is live. Record that before anything else can fail.
    await prisma.scheduledReel.update({
      where: { id: reel.id },
      data: { mediaId },
    });

    let permalink: string | null = null;
    try {
      permalink = await getMediaPermalink(token, mediaId);
    } catch {
      // The permalink is only cosmetic; the media id is what binds the campaign.
    }

    let automationId: string | null = null;
    let followUpError: string | null = null;
    try {
      automationId = await createCampaignForReel(reel, mediaId, permalink);
    } catch (error) {
      followUpError = `Posted, but the campaign was not created: ${errorMessage(error)}`;
    }

    try {
      await deleteReelObject(reel.r2Key);
    } catch (error) {
      console.error("[scheduler] could not delete video from R2", reel.r2Key, errorMessage(error));
    }

    await prisma.scheduledReel.update({
      where: { id: reel.id },
      data: {
        status: followUpError ? "FAILED" : "PUBLISHED",
        permalink,
        automationId,
        publishedAt: new Date(),
        error: followUpError,
      },
    });
    return followUpError ? "failed" : "published";
  } catch (error) {
    const current = await prisma.scheduledReel.findUnique({
      where: { id: reel.id },
      select: { mediaId: true },
    });
    const prefix = current?.mediaId
      ? `Posted (media ${current.mediaId}) but a later step failed: `
      : "";
    await prisma.scheduledReel.update({
      where: { id: reel.id },
      data: { status: "FAILED", error: `${prefix}${errorMessage(error)}`.slice(0, 1000) },
    });
    console.error("[scheduler] publish failed", reel.id, errorMessage(error));
    return "failed";
  }
}

/** Publishes every reel whose time has come. Called by the worker every minute. */
export async function processDueReels(now = new Date()) {
  await failStuckReels(now);

  const due = await prisma.scheduledReel.findMany({
    where: { status: "SCHEDULED", scheduledAt: { lte: now } },
    orderBy: { scheduledAt: "asc" },
    take: MAX_DUE_PER_RUN,
    select: { id: true },
  });

  const results = { published: 0, failed: 0, skipped: 0 };
  for (const { id } of due) {
    const outcome = await publishScheduledReel(id);
    results[outcome] += 1;
  }
  return results;
}
