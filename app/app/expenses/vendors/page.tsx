import { redirect } from "next/navigation";
export default function RedirectVendors() {
  redirect("/app/activity/expenses/vendors");
}