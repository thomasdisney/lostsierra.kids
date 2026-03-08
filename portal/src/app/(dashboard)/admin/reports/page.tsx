"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

interface Report {
  id: string;
  title: string;
  summary: string | null;
  highlights: string | null;
  weekStart: string;
  weekEnd: string;
  publishedAt: string | null;
  program: { name: string } | null;
}

export default function AdminReportsPage() {
  const [reports, setReports] = useState<Report[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    load();
  }, []);

  async function load() {
    const res = await fetch("/portal/api/admin/reports");
    const data = await res.json();
    setReports(data.reports || []);
    setLoading(false);
  }

  async function togglePublish(id: string, isPublished: boolean) {
    await fetch("/portal/api/admin/reports", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id, publish: !isPublished }),
    });
    load();
  }

  async function handleDelete(id: string) {
    await fetch("/portal/api/admin/reports", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id }),
    });
    load();
  }

  if (loading) {
    return (
      <div className="flex h-64 items-center justify-center">
        <div className="text-forest-500">Loading...</div>
      </div>
    );
  }

  return (
    <div>
      <div className="mb-8 flex items-center justify-between">
        <div>
          <h1 className="mb-1 text-2xl font-bold text-forest-900">
            Weekly Reports
          </h1>
          <p className="text-forest-600">Create and manage weekly reports</p>
        </div>
        <Link
          href="/admin/reports/new"
          className="rounded-lg bg-forest-700 px-4 py-2 text-sm font-medium text-white transition hover:bg-forest-600"
        >
          New Report
        </Link>
      </div>

      {reports.length === 0 ? (
        <div className="rounded-xl border border-paper-200 bg-white p-8 text-center text-forest-500">
          No reports yet
        </div>
      ) : (
        <div className="space-y-3">
          {reports.map((r) => (
            <div
              key={r.id}
              className="rounded-xl border border-paper-200 bg-white p-4"
            >
              <div className="mb-2 flex items-start justify-between">
                <div>
                  <h3 className="font-semibold text-forest-900">{r.title}</h3>
                  <div className="text-xs text-forest-500">
                    {r.program?.name} &middot;{" "}
                    {new Date(r.weekStart + "T00:00:00").toLocaleDateString()} &ndash;{" "}
                    {new Date(r.weekEnd + "T00:00:00").toLocaleDateString()}
                  </div>
                </div>
                <span
                  className={`rounded-full px-2 py-0.5 text-xs ${
                    r.publishedAt
                      ? "bg-green-100 text-green-700"
                      : "bg-gray-100 text-gray-600"
                  }`}
                >
                  {r.publishedAt ? "Published" : "Draft"}
                </span>
              </div>
              {r.summary && (
                <p className="mb-3 text-sm text-forest-600 line-clamp-2">
                  {r.summary}
                </p>
              )}
              <div className="flex gap-2">
                <button
                  onClick={() => togglePublish(r.id, !!r.publishedAt)}
                  className="text-xs text-forest-500 hover:text-forest-700"
                >
                  {r.publishedAt ? "Unpublish" : "Publish"}
                </button>
                <button
                  onClick={() => handleDelete(r.id)}
                  className="text-xs text-red-500 hover:text-red-700"
                >
                  Delete
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
