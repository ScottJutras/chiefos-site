// app/app/commands/page.tsx
import { redirect } from "next/navigation";

export default function CommandsRedirect() {
  redirect("/app/settings/commands");
}