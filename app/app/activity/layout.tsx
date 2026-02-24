// app/app/activity/layout.tsx
import type { ReactNode } from "react";
import ActivityTabs from "./tabs";

export default function ActivityLayout({ children }: { children: ReactNode }) {
  return (
    <div className="space-y-4">
      <ActivityTabs />
      {children}
    </div>
  );
}