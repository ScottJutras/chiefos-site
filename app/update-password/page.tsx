import { Suspense } from "react";
import UpdatePasswordClient from "./UpdatePasswordClient";

export const metadata = {
  title: "ChiefOS — Set new password",
  description: "Set a new password for your ChiefOS account.",
};

export default function UpdatePasswordPage() {
  return (
    <Suspense fallback={<div className="p-8">Loading…</div>}>
      <UpdatePasswordClient />
    </Suspense>
  );
}