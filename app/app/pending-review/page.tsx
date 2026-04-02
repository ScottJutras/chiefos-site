"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

export default function PendingReviewRedirect() {
  const router = useRouter();
  useEffect(() => {
    router.replace("/app/uploads?tab=review");
  }, [router]);
  return null;
}
