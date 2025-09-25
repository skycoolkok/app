"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const LINKS = [
  { href: "/", label: "Home" },
  { href: "/recipes", label: "Recipes" },
  { href: "/my-kitchen", label: "My Kitchen" },
  { href: "/rdi-tracker", label: "RDI Tracker" },
];

export function Navbar() {
  const pathname = usePathname();

  return (
    <header className="sticky top-0 z-50 border-b border-emerald-100 bg-white/80 backdrop-blur">
      <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-3 text-sm font-medium text-emerald-800 sm:px-8">
        <Link href="/" className="text-base font-semibold text-emerald-600">
          Juice Health
        </Link>
        <nav className="flex items-center gap-2">
          {LINKS.map((link) => {
            const active = pathname === link.href || (link.href !== "/" && pathname.startsWith(link.href));
            return (
              <Link
                key={link.href}
                href={link.href}
                className={`rounded-full px-3 py-2 transition-colors ${
                  active
                    ? "bg-emerald-500 text-white shadow"
                    : "text-emerald-700 hover:bg-emerald-100"
                }`}
              >
                {link.label}
              </Link>
            );
          })}
        </nav>
      </div>
    </header>
  );
}

