import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db/client";
import {
  canManageCampaigns,
  getCurrentWorkspaceContext,
} from "@/lib/workspace-access";

const NO_STORE = { "Cache-Control": "no-store" };

const createSchema = z.object({
  name: z.string().min(1).max(100),
  r2Key: z.string().min(1).max(300),
  caption: z.string().min(1).max(2200),
  scheduledAt: z.string().datetime(),
  keyword: z
    .string()
    .min(1)
    .max(50)
    .regex(/^\S+$/, "Keyword must be a single word")
    .default("LINK"),
  dmMessage: z.string().min(1).max(1000),
  destinationUrl: z.string().url(),
  linkButtonLabel: z.string().min(1).max(20).default("Open link"),
});

async function requireContext() {
  const context = await getCurrentWorkspaceContext();
  if (!context) {
    return {
      error: NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 }),
    } as const;
  }
  if (!canManageCampaigns(context)) {
    return {
      error: NextResponse.json(
        { success: false, error: "You do not have permission to manage scheduled reels" },
        { status: 403 }
      ),
    } as const;
  }
  return { context } as const;
}

export async function GET() {
  const result = await requireContext();
  if ("error" in result) return result.error;

  const reels = await prisma.scheduledReel.findMany({
    where: { workspaceId: result.context.workspaceId },
    orderBy: { scheduledAt: "asc" },
    select: {
      id: true,
      name: true,
      r2Key: true,
      caption: true,
      scheduledAt: true,
      status: true,
      keyword: true,
      destinationUrl: true,
      permalink: true,
      automationId: true,
      error: true,
      publishedAt: true,
    },
  });
  return NextResponse.json({ success: true, data: reels }, { headers: NO_STORE });
}

export async function POST(request: NextRequest) {
  const result = await requireContext();
  if ("error" in result) return result.error;
  const { workspaceId } = result.context;

  const parsed = createSchema.safeParse(await request.json());
  if (!parsed.success) {
    return NextResponse.json(
      { success: false, error: "Invalid input", details: parsed.error.flatten() },
      { status: 400 }
    );
  }

  const scheduledAt = new Date(parsed.data.scheduledAt);
  if (scheduledAt.getTime() < Date.now() + 2 * 60_000) {
    return NextResponse.json(
      { success: false, error: "Pick a time at least 2 minutes from now" },
      { status: 400 }
    );
  }

  const instagramAccount = await prisma.instagramAccount.findFirst({
    where: { workspaceId },
    orderBy: { connectedAt: "desc" },
    select: { id: true },
  });
  if (!instagramAccount) {
    return NextResponse.json(
      { success: false, error: "Connect Instagram before scheduling reels" },
      { status: 400 }
    );
  }

  const duplicate = await prisma.scheduledReel.findFirst({
    where: {
      workspaceId,
      r2Key: parsed.data.r2Key,
      status: { in: ["SCHEDULED", "PUBLISHING"] },
    },
    select: { id: true },
  });
  if (duplicate) {
    return NextResponse.json(
      { success: false, error: "That video is already scheduled" },
      { status: 409 }
    );
  }

  const created = await prisma.scheduledReel.create({
    data: {
      ...parsed.data,
      scheduledAt,
      keyword: parsed.data.keyword.toUpperCase(),
      workspaceId,
      instagramAccountId: instagramAccount.id,
    },
    select: { id: true },
  });
  return NextResponse.json({ success: true, data: created }, { status: 201 });
}

export async function DELETE(request: NextRequest) {
  const result = await requireContext();
  if ("error" in result) return result.error;

  const id = request.nextUrl.searchParams.get("id");
  if (!id) {
    return NextResponse.json({ success: false, error: "Missing id" }, { status: 400 });
  }

  // Only a reel that has not started publishing can be cancelled.
  const cancelled = await prisma.scheduledReel.updateMany({
    where: { id, workspaceId: result.context.workspaceId, status: "SCHEDULED" },
    data: { status: "CANCELLED" },
  });
  if (cancelled.count === 0) {
    return NextResponse.json(
      { success: false, error: "Only scheduled reels can be cancelled" },
      { status: 409 }
    );
  }
  return NextResponse.json({ success: true, data: { cancelled: true } });
}
