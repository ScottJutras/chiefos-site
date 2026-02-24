// app/app/activity/page.tsx
import { redirect } from "next/navigation";

export default function ActivityIndex() {
  redirect("/app/activity/expenses");
}