-- Add public reply options to ScheduledReel and Amazon-compliant bridge page fields to TrackedLink & ScheduledReel.
ALTER TABLE "ScheduledReel"
  ADD COLUMN "publicReplyEnabled" BOOLEAN NOT NULL DEFAULT true,
  ADD COLUMN "publicReplyMessages" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  ADD COLUMN "bridgeEnabled" BOOLEAN NOT NULL DEFAULT true,
  ADD COLUMN "productTitle" TEXT,
  ADD COLUMN "productPrice" TEXT,
  ADD COLUMN "productRating" TEXT,
  ADD COLUMN "productImageUrl" TEXT;

ALTER TABLE "TrackedLink"
  ADD COLUMN "bridgeEnabled" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN "productTitle" TEXT,
  ADD COLUMN "productPrice" TEXT,
  ADD COLUMN "productRating" TEXT,
  ADD COLUMN "productImageUrl" TEXT,
  ADD COLUMN "storeName" TEXT NOT NULL DEFAULT 'Amazon';
