import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const code = url.searchParams.get("code");

  // If no code, just send them to login
  if (!code) {
    return NextResponse.redirect(new URL("/login", url.origin));
  }

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );

  // Exchange code for session cookie
  const { error } = await supabase.auth.exchangeCodeForSession(code);

  if (error) {
    return NextResponse.redirect(new URL("/login?err=callback", url.origin));
  }

  // After session is set, send them to finish onboarding
  return NextResponse.redirect(new URL("/finish-signup", url.origin));
}
