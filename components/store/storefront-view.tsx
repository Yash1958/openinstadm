import type { StorefrontData } from "@/lib/store/query";

export function StorefrontView({ data }: { data: StorefrontData }) {
  const { username, displayName, items } = data;
  const igUrl = `https://www.instagram.com/${encodeURIComponent(username)}/`;

  return (
    <main className="min-h-dvh bg-[#FAF7F2] text-[#221F1D]">
      <div className="mx-auto max-w-2xl px-4 pb-16 pt-8 sm:px-6">
        {/* Creator Header */}
        <header className="mb-8 flex flex-col items-center text-center">
          <div className="mb-3 flex size-16 items-center justify-center rounded-full bg-gradient-to-br from-[#D4A373] via-[#C87D6B] to-[#9E5A50] text-lg font-bold tracking-wide text-white shadow-md">
            {username.slice(0, 2).toUpperCase()}
          </div>
          <h1 className="text-xl font-semibold tracking-tight text-[#1E1A18]">
            {displayName}
          </h1>
          <a
            href={igUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="mt-0.5 text-sm font-medium text-[#8C5B4D] hover:underline"
          >
            @{username}
          </a>
          <p className="mt-2 max-w-sm text-xs leading-relaxed text-[#6B625C]">
            Outfits that look expensive, but aren&apos;t. Curated Amazon fashion finds under Rs 999 — tap any look to shop directly.
          </p>
        </header>

        {/* Product Grid */}
        {items.length === 0 ? (
          <div className="rounded-2xl border border-[#E9E1D6] bg-white p-10 text-center text-sm text-[#7A716A]">
            New curated looks dropping soon. Follow @{username} on Instagram!
          </div>
        ) : (
          <section className="grid grid-cols-2 gap-3.5 sm:gap-4">
            {items.map((item) => {
              const shopHref = `/r/${encodeURIComponent(item.slug)}`;
              return (
                <article
                  key={item.id}
                  className="group flex flex-col overflow-hidden rounded-2xl border border-[#EAE2D7] bg-white shadow-[0_2px_12px_rgba(34,31,29,0.04)] transition hover:-translate-y-0.5 hover:shadow-[0_8px_24px_rgba(34,31,29,0.08)]"
                >
                  <a href={shopHref} rel="noopener noreferrer sponsored" className="block">
                    {item.imageUrl ? (
                      <div className="relative aspect-[4/5] w-full overflow-hidden bg-[#F2ECE3]">
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img
                          src={item.imageUrl}
                          alt={item.title}
                          className="h-full w-full object-cover transition duration-300 group-hover:scale-[1.03]"
                        />
                        {item.price ? (
                          <span className="absolute bottom-2 left-2 rounded-full bg-[#1E1A18]/85 px-2.5 py-0.5 text-[11px] font-semibold text-white backdrop-blur-sm">
                            {item.price}
                          </span>
                        ) : null}
                      </div>
                    ) : (
                      <div className="relative flex aspect-[4/3] w-full flex-col items-center justify-center bg-gradient-to-br from-[#F5EFE6] to-[#EADFD0] p-4 text-center">
                        <span className="rounded-full bg-white/80 px-2.5 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-[#8C5B4D]">
                          {item.storeName} Find
                        </span>
                        {item.price ? (
                          <span className="mt-2 text-lg font-bold text-[#221F1D]">
                            {item.price}
                          </span>
                        ) : null}
                      </div>
                    )}
                  </a>

                  <div className="flex flex-1 flex-col justify-between gap-2.5 p-3">
                    <div>
                      <h2 className="line-clamp-2 text-xs font-medium leading-snug text-[#221F1D] sm:text-[13px]">
                        {item.title}
                      </h2>
                      {item.rating ? (
                        <p className="mt-1 text-[11px] text-[#7A716A]">★ {item.rating}</p>
                      ) : null}
                    </div>

                    <div className="space-y-1.5">
                      <a
                        href={shopHref}
                        rel="noopener noreferrer sponsored"
                        className="flex w-full items-center justify-center rounded-xl bg-[#221F1D] px-3 py-2 text-xs font-semibold text-white transition hover:bg-[#3A3531] active:scale-[0.99]"
                      >
                        Shop on {item.storeName} →
                      </a>
                      {item.postUrl ? (
                        <a
                          href={item.postUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="block text-center text-[11px] text-[#8C5B4D] hover:underline"
                        >
                          Watch Reel
                        </a>
                      ) : null}
                    </div>
                  </div>
                </article>
              );
            })}
          </section>
        )}

        {/* Compliant Affiliate Disclosure */}
        <footer className="mt-10 border-t border-[#E9E1D6] pt-5 text-center text-[11px] leading-relaxed text-[#7A716A]">
          Affiliate disclosure: As an Amazon Associate, @{username} may earn a small commission
          from qualifying purchases at no extra cost to you. Live prices &amp; stock may vary on Amazon.
        </footer>
      </div>
    </main>
  );
}
