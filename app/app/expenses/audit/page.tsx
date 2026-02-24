import { redirect } from "next/navigation";
export default function RedirectAudit() {
  redirect("/app/activity/expenses/audit");
}