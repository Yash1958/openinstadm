import { Suspense } from "react";
import { connection } from "next/server";
import { notFound } from "next/navigation";
import { getStorefrontData } from "@/lib/store/query";
import { StorefrontView } from "@/components/store/storefront-view";

export const metadata = {
  title: "Shop Curated Finds · @mmyra.finds",
  description: "Curated Pinterest-aesthetic Amazon fashion finds under Rs 999.",
};

async function DefaultStoreContent() {
  await connection();
  const data = await getStorefrontData();
  if (!data) notFound();
  return <StorefrontView data={data} />;
}

export default function DefaultStorePage() {
  return (
    <Suspense
      fallback={
        <main className="min-h-dvh bg-[#FAF7F2] flex items-center justify-center text-sm text-[#7A716A]">
          Loading looks…
        </main>
      }
    >
      <DefaultStoreContent />
    </Suspense>
  );
}
