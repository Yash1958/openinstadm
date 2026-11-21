-- Scheduled reels: videos kept in a private R2 bucket and published by the worker.
CREATE TYPE "ScheduledReelStatus" AS ENUM ('SCHEDULED', 'PUBLISHING', 'PUBLISHED', 'FAILED', 'CANCELLED');

CREATE TABLE "ScheduledReel" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "instagramAccountId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "r2Key" TEXT NOT NULL,
    "caption" TEXT NOT NULL,
    "scheduledAt" TIMESTAMP(3) NOT NULL,
    "status" "ScheduledReelStatus" NOT NULL DEFAULT 'SCHEDULED',
    "keyword" TEXT NOT NULL DEFAULT 'LINK',
    "dmMessage" TEXT NOT NULL,
    "destinationUrl" TEXT NOT NULL,
    "linkButtonLabel" TEXT NOT NULL DEFAULT 'Open link',
    "containerId" TEXT,
    "mediaId" TEXT,
    "permalink" TEXT,
    "automationId" TEXT,
    "error" TEXT,
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "publishedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ScheduledReel_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "ScheduledReel_status_scheduledAt_idx" ON "ScheduledReel"("status", "scheduledAt");
CREATE INDEX "ScheduledReel_workspaceId_scheduledAt_idx" ON "ScheduledReel"("workspaceId", "scheduledAt");

ALTER TABLE "ScheduledReel" ADD CONSTRAINT "ScheduledReel_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ScheduledReel" ADD CONSTRAINT "ScheduledReel_instagramAccountId_fkey" FOREIGN KEY ("instagramAccountId") REFERENCES "InstagramAccount"("id") ON DELETE CASCADE ON UPDATE CASCADE;
