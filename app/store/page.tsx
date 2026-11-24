import { notFound } from "next/navigation";
import { getStorefrontData } from "@/lib/store/query";
import { StorefrontView } from "@/components/store/storefront-view";

export const dynamic = "force-dynamic";

export async function generateMetadata() {
  const data = await getStorefrontData();
  if (!data) return { title: "Shop Curated Finds" };
  return {
    title: `Shop Looks · @${data.username}`,
    description: `Curated Pinterest-aesthetic Amazon fashion finds under Rs 999 by @${data.username}.`,
  };
}

export default async function DefaultStorePage() {
  const data = await getStorefrontData();
  if (!data) notFound();
  return <StorefrontView data={data} />;
}
