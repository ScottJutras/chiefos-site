import { redirect } from "next/navigation";
export default function RedirectTrash() {
  redirect("/app/activity/expenses/trash");
}