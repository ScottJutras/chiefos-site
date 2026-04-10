"use client";

import type { ReactNode } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";

function NavLink({ href, children }: { href: string; children: ReactNode }) {
  const pathname = usePathname();
  const active = pathname?.startsWith(href);
  return (
    <Link
      href={href}
      className={`text-sm font-medium transition-colors ${
        active
          ? "text-[#D4A853]"
          : "text-[#A8A090] hover:text-[#D4A853]"
      }`}
    >
      {children}
    </Link>
  );
}

export default function SupplierLayout({ children }: { children: ReactNode }) {
  const router = useRouter();

  async function handleLogout() {
    await supabase.auth.signOut();
    router.push("/supplier/login");
  }

  return (
    <div className="min-h-screen bg-[#0C0B0A] text-[#E8E2D8]">
      {/* Top navigation bar */}
      <header className="sticky top-0 z-30 border-b border-[rgba(212,168,83,0.15)] bg-[#0C0B0A]/95 backdrop-blur-xl">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-3">
          {/* Brand */}
          <Link href="/supplier/dashboard" className="flex items-center gap-2">
            <span className="text-base font-bold tracking-tight text-[#E8E2D8]">ChiefOS</span>
            <span className="rounded border border-[rgba(212,168,83,0.3)] bg-[rgba(212,168,83,0.1)] px-1.5 py-0.5 text-xs font-medium text-[#D4A853]">
              Supplier Portal
            </span>
          </Link>

          {/* Nav links */}
          <nav className="hidden items-center gap-6 sm:flex">
            <NavLink href="/supplier/dashboard">Dashboard</NavLink>
            <NavLink href="/supplier/catalog">Catalog</NavLink>
            <NavLink href="/supplier/catalog/upload">Upload</NavLink>
          </nav>

          {/* Logout */}
          <button
            onClick={handleLogout}
            className="text-sm text-[#A8A090] transition-colors hover:text-[#D4A853]"
          >
            Sign out
          </button>
        </div>

        {/* Mobile nav */}
        <div className="flex items-center gap-4 border-t border-[rgba(212,168,83,0.1)] px-4 py-2 sm:hidden">
          <NavLink href="/supplier/dashboard">Dashboard</NavLink>
          <NavLink href="/supplier/catalog">Catalog</NavLink>
          <NavLink href="/supplier/catalog/upload">Upload</NavLink>
        </div>
      </header>

      <main className="mx-auto max-w-7xl px-4 py-8">{children}</main>
    </div>
  );
}
