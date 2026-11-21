import { notFound } from "next/navigation";
import { prisma } from "@/lib/db/client";

type BridgePageProps = {
  params: Promise<{ slug: string }>;
};

export async function generateMetadata({ params }: BridgePageProps) {
  const { slug } = await params;
  const link = await prisma.trackedLink.findUnique({
    where: { slug },
    select: {
      productTitle: true,
      productPrice: true,
      storeName: true,
      automation: {
        select: {
          name: true,
          instagramAccount: { select: { username: true } },
        },
      },
    },
  });

  if (!link) return { title: "Product link" };
  const title = link.productTitle ?? link.automation.name;
  const handle = link.automation.instagramAccount.username;
  return {
    title: `${title}${link.productPrice ? ` (${link.productPrice})` : ""} · @${handle}`,
    description: `Curated ${link.storeName || "Amazon"} find by @${handle}`,
  };
}

export default async function ProductBridgePage({ params }: BridgePageProps) {
  const { slug } = await params;
  const link = await prisma.trackedLink.findUnique({
    where: { slug },
    select: {
      slug: true,
      destinationUrl: true,
      productTitle: true,
      productPrice: true,
      productRating: true,
      productImageUrl: true,
      storeName: true,
      automation: {
        select: {
          name: true,
          instagramAccount: { select: { username: true, name: true } },
        },
      },
    },
  });

  if (!link) notFound();

  let safeDestination = false;
  try {
    const parsed = new URL(link.destinationUrl);
    safeDestination = parsed.protocol === "http:" || parsed.protocol === "https:";
  } catch {
    safeDestination = false;
  }
  if (!safeDestination) notFound();

  const title = link.productTitle ?? link.automation.name;
  const storeName = link.storeName || "Amazon";
  const username = link.automation.instagramAccount.username;
  const redirectHref = `/r/${encodeURIComponent(link.slug)}`;

  return (
    <main className="min-h-dvh bg-neutral-950 text-neutral-100 flex items-center justify-center p-4">
      <div className="w-full max-w-md rounded-2xl border border-neutral-800 bg-neutral-900/90 shadow-2xl overflow-hidden">
        <div className="flex items-center justify-between border-b border-neutral-800 px-5 py-3.5">
          <div className="flex items-center gap-2.5">
            <span className="inline-flex size-8 items-center justify-center rounded-full bg-rose-600/20 text-rose-400 text-xs font-bold uppercase">
              {username.slice(0, 2)}
            </span>
            <div>
              <div className="text-sm font-semibold tracking-tight">@{username}</div>
              <div className="text-[11px] text-neutral-400">Curated find under Rs 999</div>
            </div>
          </div>
          <span className="rounded-full border border-neutral-700 bg-neutral-800 px-2.5 py-0.5 text-[11px] font-medium text-amber-300">
            {storeName}
          </span>
        </div>

        {link.productImageUrl ? (
          <div className="relative aspect-[4/5] w-full bg-neutral-950 overflow-hidden">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={link.productImageUrl}
              alt={title}
              className="h-full w-full object-cover"
            />
          </div>
        ) : null}

        <div className="space-y-4 p-5">
          <div className="space-y-2">
            <h1 className="text-xl font-semibold leading-snug text-white">{title}</h1>
            <div className="flex flex-wrap items-center gap-2">
              {link.productPrice ? (
                <span className="rounded-lg bg-amber-400/15 px-2.5 py-1 text-sm font-semibold text-amber-300">
                  {link.productPrice}
                </span>
              ) : null}
              {link.productRating ? (
                <span className="rounded-lg bg-neutral-800 px-2.5 py-1 text-xs font-medium text-neutral-200">
                  ★ {link.productRating}
                </span>
              ) : null}
            </div>
          </div>

          <a
            href={redirectHref}
            rel="noopener noreferrer sponsored"
            className="flex w-full items-center justify-center gap-2 rounded-xl bg-amber-400 px-5 py-3.5 text-base font-semibold text-neutral-950 transition hover:bg-amber-300 active:scale-[0.99]"
          >
            Shop on {storeName} →
          </a>

          <p className="text-center text-[11px] leading-relaxed text-neutral-400">
            Affiliate disclosure: As an {storeName} associate, @{username} may earn a small
            commission at no extra cost to you. Prices may vary on {storeName}.
          </p>
        </div>
      </div>
    </main>
  );
}
