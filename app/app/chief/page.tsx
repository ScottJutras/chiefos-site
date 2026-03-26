// app/app/chief/page.tsx
import { Suspense } from "react";
import ChiefClient from "./ChiefClient";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default async function ChiefPage({
  searchParams,
}: {
  searchParams: Promise<{ embed?: string }>;
}) {
  const params = await searchParams;
  const isEmbed = params?.embed === "1";

  return (
    <>
      {isEmbed && (
        <style>{`
          header, nav { display: none !important; }
          main { padding-bottom: 0 !important; }
        `}</style>
      )}
      <Suspense fallback={<div className="p-8 text-white/70">Loading Chief…</div>}>
        <ChiefClient />
      </Suspense>
    </>
  );
}
