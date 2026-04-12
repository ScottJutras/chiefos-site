import type { ReactNode } from "react";
import AppLayoutChrome from "./components/AppLayoutChrome";

export default function AppLayout({ children }: { children: ReactNode }) {
  return <AppLayoutChrome>{children}</AppLayoutChrome>;
}
