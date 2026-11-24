import { prisma } from "@/lib/db/client";

export interface StoreItem {
  id: string;
  slug: string;
  title: string;
  price: string | null;
  rating: string | null;
  imageUrl: string | null;
  storeName: string;
  postUrl: string | null;
  createdAt: Date;
}

export interface StorefrontData {
  username: string;
  displayName: string;
  items: StoreItem[];
}

export function cleanStoreTitle(raw: string): string {
  // Strip internal reel code prefixes like "R22 — " or "V2-01 - " for clean shopper display
  return raw.replace(/^(?:R\d+|V\d+-\d+)\s*[—–-]\s*/i, "").trim();
}

export async function getStorefrontData(requestedUsername?: string): Promise<StorefrontData | null> {
  const account = requestedUsername
    ? await prisma.instagramAccount.findFirst({
        where: { username: { equals: requestedUsername.replace(/^@/, ""), mode: "insensitive" } },
        select: { id: true, username: true, name: true },
        orderBy: { connectedAt: "desc" },
      })
    : await prisma.instagramAccount.findFirst({
        select: { id: true, username: true, name: true },
        orderBy: { connectedAt: "desc" },
      });

  if (!account) return null;

  const links = await prisma.trackedLink.findMany({
    where: {
      automation: {
        instagramAccountId: account.id,
        isActive: true,
      },
    },
    select: {
      id: true,
      slug: true,
      destinationUrl: true,
      productTitle: true,
      productPrice: true,
      productRating: true,
      productImageUrl: true,
      storeName: true,
      createdAt: true,
      automation: {
        select: {
          name: true,
          postUrl: true,
        },
      },
    },
    orderBy: { createdAt: "desc" },
    take: 80,
  });

  const seenUrls = new Set<string>();
  const items: StoreItem[] = [];
  for (const link of links) {
    let safeUrl = false;
    try {
      const parsed = new URL(link.destinationUrl);
      safeUrl = parsed.protocol === "http:" || parsed.protocol === "https:";
    } catch {
      safeUrl = false;
    }
    if (!safeUrl || seenUrls.has(link.destinationUrl)) continue;
    seenUrls.add(link.destinationUrl);

    items.push({
      id: link.id,
      slug: link.slug,
      title: cleanStoreTitle(link.productTitle ?? link.automation.name),
      price: link.productPrice,
      rating: link.productRating,
      imageUrl: link.productImageUrl,
      storeName: link.storeName || "Amazon",
      postUrl: link.automation.postUrl,
      createdAt: link.createdAt,
    });
  }

  return {
    username: account.username,
    displayName: account.name || `@${account.username}`,
    items,
  };
}
