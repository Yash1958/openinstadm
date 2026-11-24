import { beforeEach, describe, expect, it, vi } from "vitest";

const { mockAccountFindFirst, mockLinkFindMany } = vi.hoisted(() => ({
  mockAccountFindFirst: vi.fn(),
  mockLinkFindMany: vi.fn(),
}));

vi.mock("@/lib/db/client", () => ({
  prisma: {
    instagramAccount: { findFirst: mockAccountFindFirst },
    trackedLink: { findMany: mockLinkFindMany },
  },
}));

import { cleanStoreTitle, getStorefrontData } from "@/lib/store/query";

describe("storefront query", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("strips internal reel prefixes cleanly", () => {
    expect(cleanStoreTitle("R22 — Wine V-neck cardigan")).toBe("Wine V-neck cardigan");
    expect(cleanStoreTitle("V2-01 - Olive linen shirt + cream pants")).toBe(
      "Olive linen shirt + cream pants"
    );
    expect(cleanStoreTitle("Striped satin shirt")).toBe("Striped satin shirt");
  });

  it("deduplicates by destinationUrl and filters unsafe URLs", async () => {
    mockAccountFindFirst.mockResolvedValue({
      id: "ig-1",
      username: "mmyra.finds",
      name: "Myra",
    });
    mockLinkFindMany.mockResolvedValue([
      {
        id: "tl-1",
        slug: "abc123",
        destinationUrl: "https://www.amazon.in/dp/B09J2BRCNG?tag=mmyrafinds21-21",
        productTitle: "R22 — Wine cardigan",
        productPrice: "Rs 429",
        productRating: "4.0",
        productImageUrl: null,
        storeName: "Amazon",
        createdAt: new Date("2026-11-24T00:00:00Z"),
        automation: { name: "R22 — Wine cardigan", postUrl: "https://instagram.com/reel/1" },
      },
      {
        id: "tl-dup",
        slug: "dup999",
        destinationUrl: "https://www.amazon.in/dp/B09J2BRCNG?tag=mmyrafinds21-21",
        productTitle: "Duplicate",
        productPrice: "Rs 429",
        productRating: null,
        productImageUrl: null,
        storeName: "Amazon",
        createdAt: new Date("2026-11-23T00:00:00Z"),
        automation: { name: "Dup", postUrl: null },
      },
      {
        id: "tl-bad",
        slug: "bad1",
        destinationUrl: "javascript:alert(1)",
        productTitle: "Bad",
        productPrice: null,
        productRating: null,
        productImageUrl: null,
        storeName: "Amazon",
        createdAt: new Date("2026-11-22T00:00:00Z"),
        automation: { name: "Bad", postUrl: null },
      },
    ]);

    const res = await getStorefrontData("mmyra.finds");
    expect(res?.username).toBe("mmyra.finds");
    expect(res?.items).toHaveLength(1);
    expect(res?.items[0].title).toBe("Wine cardigan");
    expect(res?.items[0].slug).toBe("abc123");
  });
});
