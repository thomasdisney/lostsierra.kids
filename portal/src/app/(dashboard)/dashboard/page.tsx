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
}

export default function DashboardPage() {
  const { data: session } = useSession();
  const isAdmin = session?.user?.role === "admin";
  const [registrations, setRegistrations] = useState<Registration[]>([]);
  const [adminStats, setAdminStats] = useState<AdminStats | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      if (isAdmin) {
        const res = await fetch("/portal/api/admin/registrations");
        const data = await res.json();
        const regs = data.registrations || [];
        setAdminStats({
          totalRegistrations: regs.length,
          submitted: regs.filter(
            (r: Registration) => r.status === "submitted"
          ).length,
          approved: regs.filter((r: Registration) => r.status === "approved")
            .length,
          underReview: regs.filter(
            (r: Registration) => r.status === "under_review"
          ).length,
        });
      } else {
        const res = await fetch("/portal/api/registrations");
        const data = await res.json();
        setRegistrations(data.registrations || []);
      }
      setLoading(false);
    }
    if (session) load();
  }, [session, isAdmin]);

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

  return (
    <div>
      <h1 className="mb-1 text-2xl font-bold text-forest-900">
        Welcome, {session?.user?.name}
      </h1>
      <p className="mb-8 text-forest-600">
        {isAdmin ? "Admin Dashboard" : "Family Dashboard"}
      </p>

      {isAdmin && adminStats && (
        <div className="mb-8 grid grid-cols-2 gap-4 md:grid-cols-4">
          {[
            {
              label: "Total",
              value: adminStats.totalRegistrations,
              color: "bg-forest-50 border-forest-200",
            },
            {
              label: "Submitted",
              value: adminStats.submitted,
              color: "bg-blue-50 border-blue-200",
            },
            {
              label: "Under Review",
              value: adminStats.underReview,
              color: "bg-yellow-50 border-yellow-200",
            },
            {
              label: "Approved",
              value: adminStats.approved,
              color: "bg-green-50 border-green-200",
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
      )}

      {!isAdmin && (
        <>
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

      {isAdmin && (
        <div className="grid gap-4 md:grid-cols-2">
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
              View accounts and manage roles
            </p>
          </Link>
        </div>
      )}
    </div>
  );
}
