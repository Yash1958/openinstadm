import { Suspense } from "react";
import { connection } from "next/server";
import { notFound } from "next/navigation";
import { getStorefrontData } from "@/lib/store/query";
import { StorefrontView } from "@/components/store/storefront-view";

type StoreUserProps = {
  params: Promise<{ username: string }>;
};

export const metadata = {
  title: "Shop Curated Looks",
  description: "Curated Amazon fashion finds.",
};

async function UserStoreContent({ params }: StoreUserProps) {
  await connection();
  const { username } = await params;
  const data = await getStorefrontData(username);
  if (!data) notFound();
  return <StorefrontView data={data} />;
}

export default function UserStorePage({ params }: StoreUserProps) {
  return (
    <Suspense
      fallback={
        <main className="min-h-dvh bg-[#FAF7F2] flex items-center justify-center text-sm text-[#7A716A]">
          Loading looks…
        </main>
      }
    >
      <UserStoreContent params={params} />
    </Suspense>
  );
}
