import { beforeEach, describe, expect, it, vi } from "vitest";

const {
  mockUpdateMany,
  mockFindUniqueOrThrow,
  mockScheduledUpdate,
  mockAutomationCreate,
  mockGetSignedReelUrl,
  mockDeleteReelObject,
  mockCreateReelContainer,
  mockWaitForContainerReady,
  mockPublishContainer,
  mockGetMediaPermalink,
  mockDecryptToken,
} = vi.hoisted(() => ({
  mockUpdateMany: vi.fn(),
  mockFindUniqueOrThrow: vi.fn(),
  mockScheduledUpdate: vi.fn(),
  mockAutomationCreate: vi.fn(),
  mockGetSignedReelUrl: vi.fn(),
  mockDeleteReelObject: vi.fn(),
  mockCreateReelContainer: vi.fn(),
  mockWaitForContainerReady: vi.fn(),
  mockPublishContainer: vi.fn(),
  mockGetMediaPermalink: vi.fn(),
  mockDecryptToken: vi.fn(),
}));

vi.mock("@/lib/db/client", () => ({
  prisma: {
    scheduledReel: {
      updateMany: mockUpdateMany,
      findUniqueOrThrow: mockFindUniqueOrThrow,
      update: mockScheduledUpdate,
      findUnique: vi.fn(),
      findMany: vi.fn(),
    },
    automation: {
      create: mockAutomationCreate,
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
  waitForContainerReady: mockWaitForContainerReady,
  publishContainer: mockPublishContainer,
  getMediaPermalink: mockGetMediaPermalink,
}));

import { publishScheduledReel } from "@/lib/scheduler/publish-reels";

describe("publishScheduledReel (standalone worker safety)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockUpdateMany.mockResolvedValue({ count: 1 });
    mockFindUniqueOrThrow.mockResolvedValue({
      id: "reel-1",
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
      productTitle: "Pivl Wine V-Neck Cardigan",
      productPrice: "Rs 429",
      productRating: "4.0 · 2,500+ reviews",
      productImageUrl: null,
      instagramAccount: {
        id: "ig-row-1",
        instagramId: "17841400000000099",
        accessToken: "encrypted-token",
      },
    });
    mockDecryptToken.mockReturnValue("plain-token");
    mockGetSignedReelUrl.mockResolvedValue("https://r2.example/R22.mp4?sig=1");
    mockCreateReelContainer.mockResolvedValue("container-123");
    mockWaitForContainerReady.mockResolvedValue(undefined);
    mockPublishContainer.mockResolvedValue("media-456");
    mockGetMediaPermalink.mockResolvedValue("https://instagram.com/reel/abc");
    mockAutomationCreate.mockResolvedValue({ id: "auto-789" });
    mockDeleteReelObject.mockResolvedValue(undefined);
    mockScheduledUpdate.mockResolvedValue({});
  });

  it("publishes cleanly outside Next.js and creates campaign with public reply + bridge page", async () => {
    const outcome = await publishScheduledReel("reel-1");
    expect(outcome).toBe("published");

    expect(mockCreateReelContainer).toHaveBeenCalledWith(
      expect.objectContaining({
        instagramId: "17841400000000099",
        caption: "Comment LINK!",
      })
    );
    expect(mockPublishContainer).toHaveBeenCalledWith(
      "plain-token",
      "container-123",
      expect.any(Function),
      "17841400000000099"
    );

    expect(mockAutomationCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          postId: "media-456",
          publicReplyEnabled: true,
          publicReplyMessages: expect.arrayContaining([expect.any(String)]),
          trackedLinks: {
            create: [
              expect.objectContaining({
                destinationUrl: "https://amzn.to/example",
                bridgeEnabled: true,
                productTitle: "Pivl Wine V-Neck Cardigan",
                productPrice: "Rs 429",
              }),
            ],
          },
        }),
      })
    );

    const finalCall = mockScheduledUpdate.mock.calls.at(-1)?.[0];
    expect(finalCall?.data).toMatchObject({
      status: "PUBLISHED",
      automationId: "auto-789",
      error: null,
    });
  });
});
