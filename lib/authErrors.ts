// lib/authErrors.ts
export function normalizeAuthMessage(err: any): string | null {
  const msg = String(err?.message || err || "").toLowerCase();

  // Supabase common variants
  const needsVerify =
    msg.includes("email not confirmed") ||
    (msg.includes("confirm") && msg.includes("email")) ||
    msg.includes("email confirmation") ||
    msg.includes("signup requires a valid email");

  if (needsVerify) {
    return "Verify your email: check your inbox for a confirmation link, click it, then come back and sign in again.";
  }

  const badCreds =
    msg.includes("invalid login credentials") ||
    (msg.includes("invalid") && msg.includes("credentials"));

  if (badCreds) {
    return "That email/password combo doesn’t match. Try again.";
  }

  const rateLimited = msg.includes("too many requests") || msg.includes("rate limit");
  if (rateLimited) {
    return "Too many attempts. Wait a minute and try again.";
  }

  return null; // means: show default fallback
}