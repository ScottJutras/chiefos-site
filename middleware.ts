import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

export function middleware(req: NextRequest) {
  const url = req.nextUrl;

  // If someone hits the app on the www domain, bounce them to app domain.
  const isWww = url.hostname === "www.usechiefos.com";
  const isAppPath =
    url.pathname === "/login" ||
    url.pathname.startsWith("/app");

  if (isWww && isAppPath) {
    const dest = url.clone();
    dest.hostname = "app.usechiefos.com";
    return NextResponse.redirect(dest);
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/login", "/app/:path*"],
};