"use client";

import { useSession } from "next-auth/react";
import { useEffect, useState } from "react";
import Link from "next/link";

interface Registration {
  id: string;
  status: string;
  submittedAt: string;
}

interface AdminStats {
  totalRegistrations: number;
  submitted: number;
  approved: number;
  underReview: number;
  pendingUsers: number;
  totalInvoiced: number;
  totalPaid: number;
  totalOutstanding: number;
  unreadAnnouncements: number;
}

interface ParentStats {
  unpaidCount: number;
  totalOwed: number;
  nextDue: string | null;
  recentAnnouncements: { id: string; title: string; publishedAt: string }[];
  attendanceSummary: {
    childName: string;
    present: number;
    total: number;
  }[];
}

export default function DashboardPage() {
  const { data: session } = useSession();
  const role = (session?.user as { role?: string })?.role;
  const isAdmin = role === "admin";
  const isNewUser = role === "new_user";
  const [registrations, setRegistrations] = useState<Registration[]>([]);
  const [adminStats, setAdminStats] = useState<AdminStats | null>(null);
  const [parentStats, setParentStats] = useState<ParentStats | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      if (isNewUser) {
        setLoading(false);
        return;
      }

      if (isAdmin) {
        const [regsRes, usersRes, invoicesRes] = await Promise.all([
          fetch("/portal/api/admin/registrations"),
          fetch("/portal/api/admin/users"),
          fetch("/portal/api/admin/invoices"),
        ]);
        const regsData = await regsRes.json();
        const usersData = await usersRes.json();
        const invoicesData = await invoicesRes.json();
        const regs = regsData.registrations || [];
        const users = usersData.users || [];
        const invs = invoicesData.invoices || [];

        setAdminStats({
          totalRegistrations: regs.length,
          submitted: regs.filter((r: Registration) => r.status === "submitted")
            .length,
          approved: regs.filter((r: Registration) => r.status === "approved")
            .length,
          underReview: regs.filter(
            (r: Registration) => r.status === "under_review"
          ).length,
          pendingUsers: users.filter(
            (u: { role: string }) => u.role === "new_user"
          ).length,
          totalInvoiced: invs.reduce(
            (s: number, i: { total: number }) => s + i.total,
            0
          ),
          totalPaid: invs
            .filter((i: { status: string }) => i.status === "paid")
            .reduce((s: number, i: { total: number }) => s + i.total, 0),
          totalOutstanding: invs
            .filter(
              (i: { status: string }) =>
                i.status === "sent" || i.status === "overdue"
            )
            .reduce(
              (s: number, i: { total: number; totalPaid: number }) =>
                s + (i.total - i.totalPaid),
              0
            ),
          unreadAnnouncements: 0,
        });
      } else {
        // Parent dashboard
        const [regsRes, invoicesRes, announcementsRes, attendanceRes] =
          await Promise.all([
            fetch("/portal/api/registrations"),
            fetch("/portal/api/invoices"),
            fetch("/portal/api/announcements"),
            fetch("/portal/api/attendance"),
          ]);
        const regsData = await regsRes.json();
        const invoicesData = await invoicesRes.json();
        const announcementsData = await announcementsRes.json();
        const attendanceData = await attendanceRes.json();

        setRegistrations(regsData.registrations || []);

        const invs = invoicesData.invoices || [];
        const unpaid = invs.filter(
          (i: { status: string }) =>
            i.status === "sent" || i.status === "overdue"
        );
        const announcements = announcementsData.announcements || [];
        const attendance = attendanceData.attendance || [];

        const dueDates = unpaid
          .filter((i: { dueDate: string | null }) => i.dueDate)
          .map((i: { dueDate: string }) => i.dueDate)
          .sort();

        setParentStats({
          unpaidCount: unpaid.length,
          totalOwed: unpaid.reduce(
            (s: number, i: { total: number; totalPaid: number }) =>
              s + (i.total - i.totalPaid),
            0
          ),
          nextDue: dueDates[0] || null,
          recentAnnouncements: announcements.slice(0, 3),
          attendanceSummary: attendance.map(
            (a: {
              child: { firstName: string; lastName: string };
              records: { status: string }[];
            }) => ({
              childName: `${a.child.firstName} ${a.child.lastName}`,
              present: a.records.filter(
                (r: { status: string }) => r.status === "present"
              ).length,
              total: a.records.length,
            })
          ),
        });
      }
      setLoading(false);
    }
    if (session) load();
  }, [session, isAdmin, isNewUser]);

  if (loading) {
    return (
      <div className="flex h-64 items-center justify-center">
        <div className="text-forest-500">Loading...</div>
      </div>
    );
  }

  const statusColors: Record<string, string> = {
    submitted: "bg-blue-100 text-blue-800",
    under_review: "bg-yellow-100 text-yellow-800",
    approved: "bg-green-100 text-green-800",
    rejected: "bg-red-100 text-red-800",
  };

  // new_user view
  if (isNewUser) {
    return (
      <div>
        <h1 className="mb-1 text-2xl font-bold text-forest-900">
          Welcome, {session?.user?.name}
        </h1>
        <p className="mb-8 text-forest-600">Family Portal</p>

        <div className="rounded-xl border-2 border-gold-300 bg-gold-50 p-6">
          <h2 className="mb-2 text-lg font-semibold text-forest-900">
            Account Pending Approval
          </h2>
          <p className="mb-4 text-sm text-forest-600">
            Your account is awaiting admin approval. You can register your
            family while you wait.
          </p>
          <Link
            href="/register-family"
            className="inline-block rounded-lg bg-forest-800 px-6 py-2.5 font-medium text-white transition hover:bg-forest-700"
          >
            Register Your Family
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div>
      <h1 className="mb-1 text-2xl font-bold text-forest-900">
        Welcome, {session?.user?.name}
      </h1>
      <p className="mb-8 text-forest-600">
        {isAdmin ? "Admin Dashboard" : "Family Dashboard"}
      </p>

      {/* Admin dashboard */}
      {isAdmin && adminStats && (
        <>
          <div className="mb-8 grid grid-cols-2 gap-4 md:grid-cols-4">
            {[
              {
                label: "Registrations",
                value: adminStats.totalRegistrations,
                color: "bg-forest-50 border-forest-200",
              },
              {
                label: "Submitted",
                value: adminStats.submitted,
                color: "bg-blue-50 border-blue-200",
              },
              {
                label: "Pending Users",
                value: adminStats.pendingUsers,
                color: "bg-orange-50 border-orange-200",
              },
              {
                label: "Outstanding",
                value: `$${(adminStats.totalOutstanding / 100).toFixed(0)}`,
                color: "bg-yellow-50 border-yellow-200",
              },
            ].map((stat) => (
              <div
                key={stat.label}
                className={`rounded-xl border p-4 ${stat.color}`}
              >
                <div className="text-2xl font-bold text-forest-900">
                  {stat.value}
                </div>
                <div className="text-sm text-forest-600">{stat.label}</div>
              </div>
            ))}
          </div>

          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            <Link
              href="/admin/registrations"
              className="rounded-xl border border-paper-200 bg-white p-6 transition hover:shadow-md"
            >
              <h3 className="mb-1 font-semibold text-forest-900">
                Review Registrations
              </h3>
              <p className="text-sm text-forest-600">
                View and approve family pre-registrations
              </p>
            </Link>
            <Link
              href="/admin/users"
              className="rounded-xl border border-paper-200 bg-white p-6 transition hover:shadow-md"
            >
              <h3 className="mb-1 font-semibold text-forest-900">
                Manage Users
              </h3>
              <p className="text-sm text-forest-600">
                {adminStats.pendingUsers > 0
                  ? `${adminStats.pendingUsers} accounts need approval`
                  : "View accounts and manage roles"}
              </p>
            </Link>
            <Link
              href="/admin/attendance"
              className="rounded-xl border border-paper-200 bg-white p-6 transition hover:shadow-md"
            >
              <h3 className="mb-1 font-semibold text-forest-900">
                Take Attendance
              </h3>
              <p className="text-sm text-forest-600">
                Mark daily attendance by program
              </p>
            </Link>
            <Link
              href="/admin/invoices"
              className="rounded-xl border border-paper-200 bg-white p-6 transition hover:shadow-md"
            >
              <h3 className="mb-1 font-semibold text-forest-900">
                Invoices
              </h3>
              <p className="text-sm text-forest-600">
                Create and manage billing
              </p>
            </Link>
            <Link
              href="/admin/reports"
              className="rounded-xl border border-paper-200 bg-white p-6 transition hover:shadow-md"
            >
              <h3 className="mb-1 font-semibold text-forest-900">
                Weekly Reports
              </h3>
              <p className="text-sm text-forest-600">
                Write updates for parents
              </p>
            </Link>
            <Link
              href="/admin/announcements"
              className="rounded-xl border border-paper-200 bg-white p-6 transition hover:shadow-md"
            >
              <h3 className="mb-1 font-semibold text-forest-900">
                Announcements
              </h3>
              <p className="text-sm text-forest-600">
                Post announcements to families
              </p>
            </Link>
          </div>
        </>
      )}

      {/* Parent dashboard */}
      {!isAdmin && (
        <>
          {/* Quick stats row */}
          {parentStats && (
            <div className="mb-6 grid grid-cols-2 gap-4 md:grid-cols-3">
              {parentStats.unpaidCount > 0 && (
                <Link
                  href="/billing"
                  className="rounded-xl border border-red-200 bg-red-50 p-4 transition hover:shadow-sm"
                >
                  <div className="text-xl font-bold text-red-700">
                    ${(parentStats.totalOwed / 100).toFixed(2)}
                  </div>
                  <div className="text-xs text-red-600">
                    {parentStats.unpaidCount} unpaid invoice
                    {parentStats.unpaidCount > 1 ? "s" : ""}
                    {parentStats.nextDue &&
                      ` · Due ${new Date(parentStats.nextDue + "T00:00:00").toLocaleDateString()}`}
                  </div>
                </Link>
              )}
              {parentStats.attendanceSummary.map((a) => (
                <div
                  key={a.childName}
                  className="rounded-xl border border-paper-200 bg-white p-4"
                >
                  <div className="text-xl font-bold text-forest-900">
                    {a.total > 0
                      ? `${Math.round((a.present / a.total) * 100)}%`
                      : "—"}
                  </div>
                  <div className="text-xs text-forest-600">
                    {a.childName} attendance
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Recent announcements */}
          {parentStats &&
            parentStats.recentAnnouncements.length > 0 && (
              <div className="mb-6">
                <div className="mb-2 flex items-center justify-between">
                  <h2 className="font-semibold text-forest-900">
                    Recent Announcements
                  </h2>
                  <Link
                    href="/announcements"
                    className="text-xs text-forest-500 hover:text-forest-700"
                  >
                    View all
                  </Link>
                </div>
                <div className="space-y-2">
                  {parentStats.recentAnnouncements.map((a) => (
                    <Link
                      key={a.id}
                      href="/announcements"
                      className="block rounded-lg border border-paper-200 bg-white p-3 transition hover:shadow-sm"
                    >
                      <div className="font-medium text-forest-800">
                        {a.title}
                      </div>
                      <div className="text-xs text-forest-500">
                        {new Date(a.publishedAt).toLocaleDateString()}
                      </div>
                    </Link>
                  ))}
                </div>
              </div>
            )}

          {/* Registrations */}
          {registrations.length === 0 ? (
            <div className="rounded-xl border border-paper-200 bg-white p-8 text-center">
              <div className="mb-4 text-4xl">&#127793;</div>
              <h2 className="mb-2 text-lg font-semibold text-forest-900">
                No registrations yet
              </h2>
              <p className="mb-6 text-forest-600">
                Pre-register your family for Lost Sierra Kids programs.
              </p>
              <Link
                href="/register-family"
                className="inline-block rounded-lg bg-forest-800 px-6 py-2.5 font-medium text-white transition hover:bg-forest-700"
              >
                Register Your Family
              </Link>
            </div>
          ) : (
            <div className="rounded-xl border border-paper-200 bg-white">
              <div className="border-b border-paper-200 p-4">
                <h2 className="font-semibold text-forest-900">
                  Your Registrations
                </h2>
              </div>
              {registrations.map((reg) => (
                <div
                  key={reg.id}
                  className="flex items-center justify-between border-b border-paper-100 p-4 last:border-0"
                >
                  <div>
                    <div className="text-sm font-medium text-forest-800">
                      Registration
                    </div>
                    <div className="text-xs text-forest-500">
                      {new Date(reg.submittedAt).toLocaleDateString()}
                    </div>
                  </div>
                  <span
                    className={`rounded-full px-3 py-1 text-xs font-medium ${
                      statusColors[reg.status] || "bg-gray-100 text-gray-800"
                    }`}
                  >
                    {reg.status.replace("_", " ")}
                  </span>
                </div>
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
}
