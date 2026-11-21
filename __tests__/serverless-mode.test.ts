import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const {
  mockUpdateMany,
  mockFindMany,
  mockFindUniqueOrThrow,
  mockScheduledUpdate,
  mockAutomationCreate,
  mockDmLogCount,
  mockGetSignedReelUrl,
  mockDeleteReelObject,
  mockCreateReelContainer,
  mockGetContainerStatus,
  mockPublishContainer,
  mockGetMediaPermalink,
  mockDecryptToken,
} = vi.hoisted(() => ({
  mockUpdateMany: vi.fn(),
  mockFindMany: vi.fn(),
  mockFindUniqueOrThrow: vi.fn(),
  mockScheduledUpdate: vi.fn(),
  mockAutomationCreate: vi.fn(),
  mockDmLogCount: vi.fn(),
  mockGetSignedReelUrl: vi.fn(),
  mockDeleteReelObject: vi.fn(),
  mockCreateReelContainer: vi.fn(),
  mockGetContainerStatus: vi.fn(),
  mockPublishContainer: vi.fn(),
  mockGetMediaPermalink: vi.fn(),
  mockDecryptToken: vi.fn(),
}));

vi.mock("@/lib/db/client", () => ({
  prisma: {
    scheduledReel: {
      updateMany: mockUpdateMany,
      findMany: mockFindMany,
      findUniqueOrThrow: mockFindUniqueOrThrow,
      update: mockScheduledUpdate,
      findUnique: vi.fn(),
    },
    automation: {
      create: mockAutomationCreate,
    },
    dmLog: {
      count: mockDmLogCount,
    },
  },
}));

vi.mock("@/lib/meta/oauth", () => ({
  decryptToken: mockDecryptToken,
}));

vi.mock("@/lib/storage/r2", () => ({
  getSignedReelUrl: mockGetSignedReelUrl,
  deleteReelObject: mockDeleteReelObject,
}));

vi.mock("@/lib/meta/publish", () => ({
  createReelContainer: mockCreateReelContainer,
  getContainerStatus: mockGetContainerStatus,
  waitForContainerReady: vi.fn(),
  publishContainer: mockPublishContainer,
  getMediaPermalink: mockGetMediaPermalink,
}));

import { processDueReelsServerless } from "@/lib/scheduler/publish-reels";
import { reserveDMSlot } from "@/lib/utils/rate-limiter";
import { getDiagnosticsOverview } from "@/lib/server/diagnostics";

const BASE_REEL = {
  id: "reel-sv-1",
  workspaceId: "ws-1",
  instagramAccountId: "ig-row-1",
  name: "R22 Wine Cardigan",
  r2Key: "R22.mp4",
  caption: "Comment LINK!",
  keyword: "LINK",
  dmMessage: "Hey {username}!\n{link}",
  destinationUrl: "https://amzn.to/example",
  linkButtonLabel: "Shop on Amazon",
  publicReplyEnabled: true,
  publicReplyMessages: [],
  bridgeEnabled: true,
  productTitle: "Wine Cardigan",
  productPrice: "Rs 429",
  productRating: "4.0",
  productImageUrl: null,
  containerId: null as string | null,
  instagramAccount: {
    id: "ig-row-1",
    instagramId: "17841400000000099",
    accessToken: "enc-token",
  },
};

describe("serverless mode (zero Railway / zero Redis)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubEnv("SERVERLESS_MODE", "true");
    mockDecryptToken.mockReturnValue("plain-token");
    mockGetSignedReelUrl.mockResolvedValue("https://r2.example/R22.mp4?sig=1");
    mockCreateReelContainer.mockResolvedValue("container-sv-1");
    mockPublishContainer.mockResolvedValue("media-sv-1");
    mockGetMediaPermalink.mockResolvedValue("https://instagram.com/reel/sv1");
    mockAutomationCreate.mockResolvedValue({ id: "auto-sv-1" });
    mockDeleteReelObject.mockResolvedValue(undefined);
    mockScheduledUpdate.mockResolvedValue({});
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("enforces hourly DM rate limit via Postgres without Redis", async () => {
    mockDmLogCount.mockResolvedValueOnce(12);
    const ok = await reserveDMSlot("17841400000000099");
    expect(ok.allowed).toBe(true);
    expect(ok.currentCount).toBe(13);

    mockDmLogCount.mockResolvedValueOnce(750);
    const blocked = await reserveDMSlot("17841400000000099");
    expect(blocked.allowed).toBe(false);
    expect(blocked.shouldSkip).toBe(true);
  });

  it("reports healthy serverless diagnostics without touching Redis", async () => {
    const overview = await getDiagnosticsOverview();
    expect(overview.redisAvailable).toBe(true);
    expect(overview.workerHealth.healthy).toBe(true);
    expect(overview.workerHealth.heartbeat?.hostname).toBe("vercel-serverless");
  });

  it("runs 2-step reel publishing cleanly across cron ticks without timing out", async () => {
    // Tick 1: no in-flight, 1 due reel -> creates container, still IN_PROGRESS
    mockUpdateMany
      .mockResolvedValueOnce({ count: 0 }) // failStuckReels
      .mockResolvedValueOnce({ count: 1 }); // claim SCHEDULED -> PUBLISHING
    mockFindMany
      .mockResolvedValueOnce([]) // inFlight
      .mockResolvedValueOnce([{ id: "reel-sv-1" }]); // due
    mockFindUniqueOrThrow.mockResolvedValueOnce(BASE_REEL);
    mockGetContainerStatus.mockResolvedValueOnce({ statusCode: "IN_PROGRESS" });

    const tick1 = await processDueReelsServerless();
    expect(tick1).toEqual({ started: 1, stillProcessing: 0, published: 0, failed: 0 });
    expect(mockCreateReelContainer).toHaveBeenCalledTimes(1);
    expect(mockPublishContainer).not.toHaveBeenCalled();

    // Tick 2: 1 in-flight with containerId -> FINISHED -> publishes + creates campaign + deletes R2
    mockUpdateMany.mockResolvedValueOnce({ count: 0 }); // failStuckReels
    mockFindMany
      .mockResolvedValueOnce([{ ...BASE_REEL, containerId: "container-sv-1" }]) // inFlight
      .mockResolvedValueOnce([]); // due
    mockGetContainerStatus.mockResolvedValueOnce({ statusCode: "FINISHED" });

    const tick2 = await processDueReelsServerless();
    expect(tick2).toEqual({ started: 0, stillProcessing: 0, published: 1, failed: 0 });
    expect(mockPublishContainer).toHaveBeenCalledWith(
      "plain-token",
      "container-sv-1",
      expect.any(Function),
      "17841400000000099"
    );
    expect(mockAutomationCreate).toHaveBeenCalledTimes(1);
    expect(mockDeleteReelObject).toHaveBeenCalledWith("R22.mp4");
  });
});
