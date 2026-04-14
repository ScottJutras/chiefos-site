// app/employee/layout.tsx
// Minimal layout for employee portal — no owner chrome, no Ask Chief.
import type { ReactNode } from "react";
import EmployeeLayoutChrome from "./components/EmployeeLayoutChrome";

export default function EmployeeLayout({ children }: { children: ReactNode }) {
  return <EmployeeLayoutChrome>{children}</EmployeeLayoutChrome>;
}
