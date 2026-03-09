"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

interface Program {
  id: string;
  name: string;
}

export default function NewReportPage() {
  const router = useRouter();
  const [programs, setPrograms] = useState<Program[]>([]);
  const [programId, setProgramId] = useState("");
  const [weekStart, setWeekStart] = useState("");
  const [weekEnd, setWeekEnd] = useState("");
  const [title, setTitle] = useState("");
  const [summary, setSummary] = useState("");
  const [highlights, setHighlights] = useState("");
  const [notes, setNotes] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    loadPrograms();
    // Default to this week
    const now = new Date();
    const monday = new Date(now);
    monday.setDate(now.getDate() - now.getDay() + 1);
    const friday = new Date(monday);
    friday.setDate(monday.getDate() + 4);
    setWeekStart(monday.toISOString().split("T")[0]);
    setWeekEnd(friday.toISOString().split("T")[0]);
  }, []);

  async function loadPrograms() {
    const res = await fetch("/portal/api/admin/programs");
    const data = await res.json();
    setPrograms(data.programs || []);
  }

  async function handleSubmit(publish: boolean) {
    setSaving(true);
    const res = await fetch("/portal/api/admin/reports", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        programId,
        weekStart,
        weekEnd,
        title,
        summary,
        highlights,
        notes,
        publish,
      }),
    });

    if (res.ok) {
      router.push("/portal/admin/reports");
    }
    setSaving(false);
  }

  const valid = programId && weekStart && weekEnd && title;

  return (
    <div>
      <h1 className="mb-1 text-2xl font-bold text-forest-900">
        New Weekly Report
      </h1>
      <p className="mb-8 text-forest-600">
        Create a report for parents to see
      </p>

      <div className="rounded-xl border border-paper-200 bg-white p-6">
        <div className="mb-4">
          <label className="mb-1 block text-sm font-medium text-forest-700">
            Program
          </label>
          <select
            value={programId}
            onChange={(e) => setProgramId(e.target.value)}
            className="w-full rounded-lg border border-paper-200 px-3 py-2 text-sm focus:border-forest-500 focus:outline-none"
          >
            <option value="">Select program...</option>
            {programs.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </select>
        </div>

        <div className="mb-4 flex gap-4">
          <div className="flex-1">
            <label className="mb-1 block text-sm font-medium text-forest-700">
              Week Start
            </label>
            <input
              type="date"
              value={weekStart}
              onChange={(e) => setWeekStart(e.target.value)}
              className="w-full rounded-lg border border-paper-200 px-3 py-2 text-sm focus:border-forest-500 focus:outline-none"
            />
          </div>
          <div className="flex-1">
            <label className="mb-1 block text-sm font-medium text-forest-700">
              Week End
            </label>
            <input
              type="date"
              value={weekEnd}
              onChange={(e) => setWeekEnd(e.target.value)}
              className="w-full rounded-lg border border-paper-200 px-3 py-2 text-sm focus:border-forest-500 focus:outline-none"
            />
          </div>
        </div>

        <div className="mb-4">
          <label className="mb-1 block text-sm font-medium text-forest-700">
            Title
          </label>
          <input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            className="w-full rounded-lg border border-paper-200 px-3 py-2 text-sm focus:border-forest-500 focus:outline-none"
            placeholder="e.g. Week of March 2 — Nature & Art"
          />
        </div>

        <div className="mb-4">
          <label className="mb-1 block text-sm font-medium text-forest-700">
            Summary
          </label>
          <textarea
            value={summary}
            onChange={(e) => setSummary(e.target.value)}
            rows={3}
            className="w-full rounded-lg border border-paper-200 px-3 py-2 text-sm focus:border-forest-500 focus:outline-none"
            placeholder="Overview of the week..."
          />
        </div>

        <div className="mb-4">
          <label className="mb-1 block text-sm font-medium text-forest-700">
            Highlights
          </label>
          <textarea
            value={highlights}
            onChange={(e) => setHighlights(e.target.value)}
            rows={3}
            className="w-full rounded-lg border border-paper-200 px-3 py-2 text-sm focus:border-forest-500 focus:outline-none"
            placeholder="Key moments, achievements..."
          />
        </div>

        <div className="mb-6">
          <label className="mb-1 block text-sm font-medium text-forest-700">
            Notes
          </label>
          <textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            rows={2}
            className="w-full rounded-lg border border-paper-200 px-3 py-2 text-sm focus:border-forest-500 focus:outline-none"
            placeholder="Any additional notes for parents..."
          />
        </div>

        <div className="flex gap-3">
          <button
            onClick={() => handleSubmit(true)}
            disabled={saving || !valid}
            className="rounded-lg bg-forest-700 px-4 py-2 text-sm font-medium text-white transition hover:bg-forest-600 disabled:opacity-50"
          >
            {saving ? "Saving..." : "Publish"}
          </button>
          <button
            onClick={() => handleSubmit(false)}
            disabled={saving || !valid}
            className="rounded-lg border border-paper-300 px-4 py-2 text-sm font-medium text-forest-700 transition hover:bg-paper-100 disabled:opacity-50"
          >
            Save Draft
          </button>
          <button
            onClick={() => router.push("/portal/admin/reports")}
            className="px-4 py-2 text-sm text-forest-500 hover:text-forest-700"
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
}
