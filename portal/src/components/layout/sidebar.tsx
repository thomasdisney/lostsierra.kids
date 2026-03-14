"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useSession, signOut } from "next-auth/react";
import { useEffect, useState, useRef } from "react";

const allParentLinks = [
  { href: "/portal/dashboard", label: "Dashboard", icon: "M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" },
  { href: "/portal/register-family", label: "Register Family", icon: "M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z", hideAfterRegistration: true },
  { href: "/portal/children", label: "My Children", icon: "M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" },
  { href: "/portal/family", label: "Family Profile", icon: "M5.121 17.804A13.937 13.937 0 0112 16c2.5 0 4.847.655 6.879 1.804M15 10a3 3 0 11-6 0 3 3 0 016 0zM21 12a9 9 0 11-18 0 9 9 0 0118 0z" },
  { href: "/portal/announcements", label: "Announcements", icon: "M11 5.882V19.24a1.76 1.76 0 01-3.417.592l-2.147-6.15M18 13a3 3 0 100-6M5.436 13.683A4.001 4.001 0 017 6h1.832c4.1 0 7.625-1.234 9.168-3v14c-1.543-1.766-5.067-3-9.168-3H7a3.988 3.988 0 01-1.564-.317z" },
  { href: "/portal/attendance", label: "Attendance", icon: "M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4", parentOnly: true },
  { href: "/portal/billing", label: "Billing", icon: "M17 9V7a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2m2 4h10a2 2 0 002-2v-6a2 2 0 00-2-2H9a2 2 0 00-2 2v6a2 2 0 002 2zm7-5a2 2 0 11-4 0 2 2 0 014 0z", parentOnly: true },
  { href: "/portal/reports", label: "Weekly Reports", icon: "M9 17v-2m3 2v-4m3 4v-6m2 10H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z", parentOnly: true },
];

const newUserLinks = [
  { href: "/portal/dashboard", label: "Dashboard", icon: "M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" },
  { href: "/portal/register-family", label: "Register Family", icon: "M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" },
];

const adminLinks = [
  { href: "/portal/admin/registrations", label: "All Registrations", icon: "M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" },
  { href: "/portal/admin/families", label: "All Families", icon: "M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" },
  { href: "/portal/admin/users", label: "Manage Users", icon: "M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" },
  { href: "/portal/admin/programs", label: "Programs", icon: "M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" },
  { href: "/portal/admin/attendance", label: "Attendance", icon: "M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" },
  { href: "/portal/admin/invoices", label: "Invoices", icon: "M17 9V7a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2m2 4h10a2 2 0 002-2v-6a2 2 0 00-2-2H9a2 2 0 00-2 2v6a2 2 0 002 2zm7-5a2 2 0 11-4 0 2 2 0 014 0z" },
  { href: "/portal/admin/reports", label: "Weekly Reports", icon: "M9 17v-2m3 2v-4m3 4v-6m2 10H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" },
  { href: "/portal/admin/announcements", label: "Announcements", icon: "M11 5.882V19.24a1.76 1.76 0 01-3.417.592l-2.147-6.15M18 13a3 3 0 100-6M5.436 13.683A4.001 4.001 0 017 6h1.832c4.1 0 7.625-1.234 9.168-3v14c-1.543-1.766-5.067-3-9.168-3H7a3.988 3.988 0 01-1.564-.317z" },
];

function NavLink({ link, isActive, isAdminLink }: {
  link: { href: string; label: string; icon: string };
  isActive: boolean;
  isAdminLink?: boolean;
}) {
  return (
    <Link
      href={link.href}
      className={`mb-1 flex items-center gap-3 rounded-lg px-3 py-2 text-sm transition-colors ${
        isActive
          ? isAdminLink
            ? "bg-gold-100 font-medium text-forest-800"
            : "bg-forest-50 font-medium text-forest-800"
          : "text-forest-600 hover:bg-paper-100 hover:text-forest-800"
      }`}
    >
      <svg className="h-5 w-5 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
        <path strokeLinecap="round" strokeLinejoin="round" d={link.icon} />
      </svg>
      {link.label}
    </Link>
  );
}

export function Sidebar() {
  const pathname = usePathname();
  const { data: session, status } = useSession();
  const role = (session?.user as { role?: string })?.role;
  const isAdmin = role === "admin";
  const isNewUser = role === "new_user";
  const isNewAccount = role === "new_account";
  // Default to true to prevent flash of "Register Family" link
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

  // Don't render links until session is ready
  if (status === "loading") {
    return (
      <aside className="flex h-screen w-64 flex-col border-r border-paper-200 bg-white">
        <div className="border-b border-paper-200 p-6">
          <h1 className="text-lg font-bold text-forest-900">Lost Sierra Kids</h1>
          <p className="text-xs text-forest-600">Family Portal</p>
        </div>
        <nav className="flex-1 p-4">
          <div className="space-y-2">
            {[1, 2, 3].map((i) => (
              <div key={i} className="h-9 animate-pulse rounded-lg bg-paper-100" />
            ))}
          </div>
        </nav>
      </aside>
    );
  }

  let visibleLinks;
  if (isNewUser) {
    visibleLinks = newUserLinks;
  } else {
    visibleLinks = allParentLinks.filter((link) => {
      if (isNewAccount && (link as { parentOnly?: boolean }).parentOnly) return false;
      if ((link as { hideAfterRegistration?: boolean }).hideAfterRegistration && hasRegistration) return false;
      return true;
    });
  }

  return (
    <aside className="flex h-screen w-64 flex-col border-r border-paper-200 bg-white">
      <div className="border-b border-paper-200 p-6">
        <Link href="/portal/dashboard">
          <h1 className="text-lg font-bold text-forest-900">Lost Sierra Kids</h1>
          <p className="text-xs text-forest-600">Family Portal</p>
        </Link>
      </div>

      <nav className="flex-1 overflow-y-auto p-4">
        <div className="mb-2 text-xs font-semibold uppercase tracking-wider text-paper-300">
          {isNewUser ? "Getting Started" : "Family"}
        </div>
        {visibleLinks.map((link) => (
          <NavLink
            key={link.href}
            link={link}
            isActive={pathname === link.href || (link.href !== "/portal/dashboard" && pathname.startsWith(link.href + "/"))}
          />
        ))}

        {isAdmin && (
          <>
            <div className="mb-2 mt-6 text-xs font-semibold uppercase tracking-wider text-paper-300">Admin</div>
            {adminLinks.map((link) => (
              <NavLink key={link.href} link={link} isActive={pathname === link.href || pathname.startsWith(link.href + "/")} isAdminLink />
            ))}
          </>
        )}
      </nav>

      <div className="border-t border-paper-200 p-4">
        <div className="mb-2 text-sm font-medium text-forest-800">{session?.user?.name}</div>
        <div className="mb-3 text-xs text-forest-600">{session?.user?.email}</div>
        <button
          onClick={() => signOut({ callbackUrl: "/portal/login" })}
          className="w-full rounded-lg border border-paper-300 px-3 py-1.5 text-sm text-forest-600 transition hover:bg-paper-100"
        >
          Sign Out
        </button>
      </div>
    </aside>
  );
}
