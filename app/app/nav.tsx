"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";

// Primary bar — always visible on mobile
const primaryItems = [
  { href: "/app/dashboard",          label: "Dashboard" },
  { href: "/app/jobs",               label: "Jobs"      },
  { href: "/app/activity/expenses",  label: "My Books"  },
  { href: "/app/uploads",            label: "Inbox"     },
  { href: "/app/crew/members",       label: "Crew"      },
];

// "More" dropdown — secondary pages
const secondaryItems = [
  { href: "/app/overhead",           label: "Overhead"  },
  { href: "/app/chief",              label: "Ask Chief" },
  { href: "/app/settings",           label: "Settings"  },
  { href: "/app/settings/billing",   label: "Billing"   },
];

function isActive(pathname: string, href: string) {
  return pathname === href || pathname.startsWith(href + "/");
}

export function AppNav() {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement | null>(null);

  const moreActive = secondaryItems.some((it) => isActive(pathname, it.href));

  useEffect(() => {
    function onMouseDown(e: MouseEvent) {
      if (!menuRef.current) return;
      if (e.target instanceof Node && !menuRef.current.contains(e.target)) {
        setOpen(false);
      }
    }
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    document.addEventListener("mousedown", onMouseDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("mousedown", onMouseDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, []);

  return (
    <nav className="flex items-center gap-2 overflow-visible whitespace-nowrap">
      {primaryItems.map((it) => {
        const active = isActive(pathname, it.href);
        return (
          <Link
            key={it.href}
            href={it.href}
            className={[
              "rounded-xl px-3 py-1.5 text-sm font-medium transition border",
              active
                ? "border-white/20 bg-white text-black"
                : "border-white/10 bg-white/5 text-white/80 hover:bg-white/10 hover:text-white",
            ].join(" ")}
          >
            {it.label}
          </Link>
        );
      })}

      <div className="relative" ref={menuRef}>
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          className={[
            "inline-flex items-center gap-2 rounded-xl px-3 py-1.5 text-sm font-medium transition border",
            open || moreActive
              ? "border-white/20 bg-white text-black"
              : "border-white/10 bg-white/5 text-white/80 hover:bg-white/10 hover:text-white",
          ].join(" ")}
          aria-haspopup="menu"
          aria-expanded={open}
        >
          More
          <span className="text-[10px]">{open ? "▲" : "▼"}</span>
        </button>

        {open && (
          <div
            className="absolute left-0 top-full z-50 mt-2 w-52 rounded-2xl border border-white/10 bg-black/95 p-2 shadow-[0_20px_60px_rgba(0,0,0,0.55)] backdrop-blur-xl"
            role="menu"
          >
            {secondaryItems.map((it) => {
              const active = isActive(pathname, it.href);
              return (
                <Link
                  key={it.href}
                  href={it.href}
                  onClick={() => setOpen(false)}
                  className={[
                    "block rounded-xl px-3 py-2 text-sm transition",
                    active
                      ? "bg-white text-black"
                      : "text-white/80 hover:bg-white/10 hover:text-white",
                  ].join(" ")}
                  role="menuitem"
                >
                  {it.label}
                </Link>
              );
            })}
          </div>
        )}
      </div>
    </nav>
  );
}
