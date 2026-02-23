import { Suspense } from "react";
import ResetPasswordClient from "./ResetPasswordClient";

export const metadata = {
  title: "ChiefOS — Reset password",
  description: "Reset your ChiefOS password.",
};

export default function ResetPasswordPage() {
  return (
    <Suspense fallback={<div className="p-8">Loading…</div>}>
      <ResetPasswordClient />
    </Suspense>
  );
}