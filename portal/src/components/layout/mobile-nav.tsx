"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useSession } from "next-auth/react";
import { useEffect, useState, useRef } from "react";

const icons = {
  home: "M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6",
  updates: "M11 5.882V19.24a1.76 1.76 0 01-3.417.592l-2.147-6.15M18 13a3 3 0 100-6M5.436 13.683A4.001 4.001 0 017 6h1.832c4.1 0 7.625-1.234 9.168-3v14c-1.543-1.766-5.067-3-9.168-3H7a3.988 3.988 0 01-1.564-.317z",
  children: "M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z",
  family: "M5.121 17.804A13.937 13.937 0 0112 16c2.5 0 4.847.655 6.879 1.804M15 10a3 3 0 11-6 0 3 3 0 016 0zM21 12a9 9 0 11-18 0 9 9 0 0118 0z",
  billing: "M17 9V7a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2m2 4h10a2 2 0 002-2v-6a2 2 0 00-2-2H9a2 2 0 00-2 2v6a2 2 0 002 2zm7-5a2 2 0 11-4 0 2 2 0 014 0z",
  register: "M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z",
  admin: "M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2",
};

type NavItem = { href: string; label: string; icon: string };

export function MobileNav() {
  const pathname = usePathname();
  const { data: session, status } = useSession();
  const role = (session?.user as { role?: string })?.role;
  const isAdmin = role === "admin";
  const isNewUser = role === "new_user";
  const isNewAccount = role === "new_account";
  const [hasRegistration, setHasRegistration] = useState(true);
  const fetched = useRef(false);

  useEffect(() => {
    if (fetched.current || status === "loading") return;
    if (isNewAccount || role === "parent") {
      fetched.current = true;
      fetch("/portal/api/registrations")
        .then((r) => r.json())
        .then((data) => setHasRegistration((data.registrations || []).length > 0))
        .catch(() => {});
    } else {
      setHasRegistration(false);
    }
  }, [role, isNewAccount, status]);

  // Don't render until session is ready
  if (status === "loading") return null;

  let links: NavItem[];

  if (isNewUser) {
    links = [
      { href: "/portal/dashboard", label: "Home", icon: icons.home },
      { href: "/portal/register-family", label: "Register", icon: icons.register },
    ];
  } else if (isNewAccount) {
    links = [
      { href: "/portal/dashboard", label: "Home", icon: icons.home },
      ...(hasRegistration ? [] : [{ href: "/portal/register-family", label: "Register", icon: icons.register }]),
      { href: "/portal/announcements", label: "Updates", icon: icons.updates },
      { href: "/portal/children", label: "Children", icon: icons.children },
      { href: "/portal/family", label: "Family", icon: icons.family },
    ];
  } else {
    // parent + admin
    links = [
      { href: "/portal/dashboard", label: "Home", icon: icons.home },
      { href: "/portal/billing", label: "Billing", icon: icons.billing },
      { href: "/portal/announcements", label: "Updates", icon: icons.updates },
      { href: "/portal/children", label: "Children", icon: icons.children },
      { href: "/portal/family", label: "Family", icon: icons.family },
    ];
  }

  if (isAdmin) {
    links.push({ href: "/portal/admin/registrations", label: "Admin", icon: icons.admin });
  }

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-50 border-t border-paper-200 bg-white md:hidden" style={{ paddingBottom: "env(safe-area-inset-bottom)" }}>
      <div className="flex items-center justify-around py-2">
        {links.map((link) => {
          const active = pathname === link.href || pathname.startsWith(link.href + "/");
          return (
            <Link
              key={link.href}
              href={link.href}
              className={`flex flex-col items-center gap-0.5 px-1 py-1 text-[10px] transition-colors ${
                active ? "font-medium text-forest-800" : "text-forest-500"
              }`}
            >
              <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d={link.icon} />
              </svg>
              {link.label}
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
