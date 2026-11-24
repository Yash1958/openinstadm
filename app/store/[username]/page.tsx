import { notFound } from "next/navigation";
import { getStorefrontData } from "@/lib/store/query";
import { StorefrontView } from "@/components/store/storefront-view";

export const dynamic = "force-dynamic";

type StoreUserProps = {
  params: Promise<{ username: string }>;
};

export async function generateMetadata({ params }: StoreUserProps) {
  const { username } = await params;
  const data = await getStorefrontData(username);
  if (!data) return { title: "Shop Curated Finds" };
  return {
    title: `Shop Looks · @${data.username}`,
    description: `Curated finds by @${data.username}.`,
  };
}

export default async function UserStorePage({ params }: StoreUserProps) {
  const { username } = await params;
  const data = await getStorefrontData(username);
  if (!data) notFound();
  return <StorefrontView data={data} />;
}
