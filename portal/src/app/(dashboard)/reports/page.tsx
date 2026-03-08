"use client";

import { useEffect, useState } from "react";

interface Report {
  id: string;
  title: string;
  summary: string | null;
  highlights: string | null;
  notes: string | null;
  weekStart: string;
  weekEnd: string;
  publishedAt: string;
  program: { name: string } | null;
}

export default function ReportsPage() {
  const [reports, setReports] = useState<Report[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  useEffect(() => {
    load();
  }, []);

  async function load() {
    const res = await fetch("/portal/api/reports");
    const data = await res.json();
    setReports(data.reports || []);
    setLoading(false);
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
      <h1 className="mb-1 text-2xl font-bold text-forest-900">
        Weekly Reports
      </h1>
      <p className="mb-8 text-forest-600">
        Updates from your children&apos;s programs
      </p>

      {reports.length === 0 ? (
        <div className="rounded-xl border border-paper-200 bg-white p-8 text-center text-forest-500">
          No reports available yet
        </div>
      ) : (
        <div className="space-y-4">
          {reports.map((r) => (
            <div
              key={r.id}
              className="rounded-xl border border-paper-200 bg-white"
            >
              <button
                onClick={() =>
                  setExpandedId(expandedId === r.id ? null : r.id)
                }
                className="flex w-full items-center justify-between p-5 text-left"
              >
                <div>
                  <h3 className="font-semibold text-forest-900">{r.title}</h3>
                  <div className="text-xs text-forest-500">
                    {r.program?.name} &middot;{" "}
                    {new Date(r.weekStart + "T00:00:00").toLocaleDateString()} &ndash;{" "}
                    {new Date(r.weekEnd + "T00:00:00").toLocaleDateString()}
                  </div>
                </div>
                <svg
                  className={`h-5 w-5 text-forest-400 transition ${
                    expandedId === r.id ? "rotate-180" : ""
                  }`}
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                  strokeWidth={2}
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M19 9l-7 7-7-7"
                  />
                </svg>
              </button>

              {expandedId === r.id && (
                <div className="border-t border-paper-100 p-5">
                  {r.summary && (
                    <div className="mb-4">
                      <h4 className="mb-1 text-sm font-semibold text-forest-700">
                        Summary
                      </h4>
                      <p className="whitespace-pre-wrap text-sm text-forest-600">
                        {r.summary}
                      </p>
                    </div>
                  )}
                  {r.highlights && (
                    <div className="mb-4">
                      <h4 className="mb-1 text-sm font-semibold text-forest-700">
                        Highlights
                      </h4>
                      <p className="whitespace-pre-wrap text-sm text-forest-600">
                        {r.highlights}
                      </p>
                    </div>
                  )}
                  {r.notes && (
                    <div>
                      <h4 className="mb-1 text-sm font-semibold text-forest-700">
                        Notes
                      </h4>
                      <p className="whitespace-pre-wrap text-sm text-forest-600">
                        {r.notes}
                      </p>
                    </div>
                  )}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
