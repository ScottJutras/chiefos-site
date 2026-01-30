import type { ReactNode } from "react";

export default function AppLayout({ children }: { children: ReactNode }) {
  // Keep this minimal. Root layout (app/layout.tsx) should already include
  // globals.css, fonts, and ToastProvider.
  return <>{children}</>;
}
