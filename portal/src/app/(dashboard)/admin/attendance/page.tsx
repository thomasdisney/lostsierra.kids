"use client";

import { useEffect, useState } from "react";

interface Program {
  id: string;
  name: string;
}

interface ChildAttendance {
  child: { id: string; firstName: string; lastName: string };
  enrollmentId: string;
  attendance: {
    id: string;
    status: string;
    notes: string | null;
  } | null;
}

export default function AdminAttendancePage() {
  const [programs, setPrograms] = useState<Program[]>([]);
  const [selectedProgram, setSelectedProgram] = useState("");
  const [selectedDate, setSelectedDate] = useState(
    new Date().toISOString().split("T")[0]
  );
  const [children, setChildren] = useState<ChildAttendance[]>([]);
  const [statuses, setStatuses] = useState<
    Record<string, { status: string; notes: string }>
  >({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    loadPrograms();
  }, []);

  useEffect(() => {
    if (selectedProgram && selectedDate) {
      loadAttendance();
    }
  }, [selectedProgram, selectedDate]);

  async function loadPrograms() {
    const res = await fetch("/portal/api/admin/programs");
    const data = await res.json();
    setPrograms(data.programs || []);
    setLoading(false);
  }

  async function loadAttendance() {
    const res = await fetch(
      `/portal/api/admin/attendance?programId=${selectedProgram}&date=${selectedDate}`
    );
    const data = await res.json();
    const kids = data.children || [];
    setChildren(kids);

    const initial: Record<string, { status: string; notes: string }> = {};
    for (const k of kids) {
      initial[k.child.id] = {
        status: k.attendance?.status || "present",
        notes: k.attendance?.notes || "",
      };
    }
    setStatuses(initial);
    setSaved(false);
  }

  function setStatus(childId: string, status: string) {
    setStatuses((prev) => ({
      ...prev,
      [childId]: { ...prev[childId], status },
    }));
    setSaved(false);
  }

  async function handleSave() {
    setSaving(true);
    const records = children.map((c) => ({
      childId: c.child.id,
      programId: selectedProgram,
      date: selectedDate,
      status: statuses[c.child.id]?.status || "present",
      notes: statuses[c.child.id]?.notes || "",
    }));

    await fetch("/portal/api/admin/attendance", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ records }),
    });

    setSaving(false);
    setSaved(true);
  }

  if (loading) {
    return (
      <div>
        <div className="mb-2 h-7 w-44 animate-pulse rounded-lg bg-paper-200" />
        <div className="mb-8 h-4 w-56 animate-pulse rounded-lg bg-paper-200" />
        <div className="space-y-3">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="h-14 animate-pulse rounded-xl bg-paper-100" />
          ))}
        </div>
      </div>
    );
  }

  const statusOptions = [
    { value: "present", label: "Present", color: "bg-green-100 text-green-700 border-green-300" },
    { value: "absent", label: "Absent", color: "bg-red-100 text-red-700 border-red-300" },
    { value: "excused", label: "Excused", color: "bg-yellow-100 text-yellow-700 border-yellow-300" },
  ];

  return (
    <div>
      <h1 className="mb-1 text-2xl font-bold text-forest-900">
        Attendance
      </h1>
      <p className="mb-8 text-forest-600">
        Mark daily attendance by program
      </p>

      <div className="mb-6 flex flex-wrap gap-4">
        <div className="flex-1 min-w-[200px]">
          <label className="mb-1 block text-sm font-medium text-forest-700">
            Program
          </label>
          <select
            value={selectedProgram}
            onChange={(e) => setSelectedProgram(e.target.value)}
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
        <div className="min-w-[180px]">
          <label className="mb-1 block text-sm font-medium text-forest-700">
            Date
          </label>
          <input
            type="date"
            value={selectedDate}
            onChange={(e) => setSelectedDate(e.target.value)}
            className="w-full rounded-lg border border-paper-200 px-3 py-2 text-sm focus:border-forest-500 focus:outline-none"
          />
        </div>
      </div>

      {!selectedProgram ? (
        <div className="rounded-xl border border-paper-200 bg-white p-8 text-center text-forest-500">
          Select a program to take attendance
        </div>
      ) : children.length === 0 ? (
        <div className="rounded-xl border border-paper-200 bg-white p-8 text-center text-forest-500">
          No enrolled children in this program
        </div>
      ) : (
        <>
          <div className="mb-4 rounded-xl border border-paper-200 bg-white">
            {children.map((c, i) => (
              <div
                key={c.child.id}
                className={`flex items-center justify-between p-4 ${
                  i < children.length - 1 ? "border-b border-paper-100" : ""
                }`}
              >
                <div className="font-medium text-forest-900">
                  {c.child.firstName} {c.child.lastName}
                </div>
                <div className="flex gap-2">
                  {statusOptions.map((opt) => (
                    <button
                      key={opt.value}
                      onClick={() => setStatus(c.child.id, opt.value)}
                      className={`rounded-lg border px-3 py-1.5 text-xs font-medium transition ${
                        statuses[c.child.id]?.status === opt.value
                          ? opt.color
                          : "border-paper-200 bg-white text-forest-500 hover:bg-paper-100"
                      }`}
                    >
                      {opt.label}
                    </button>
                  ))}
                </div>
              </div>
            ))}
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={handleSave}
              disabled={saving}
              className="rounded-lg bg-forest-700 px-6 py-2 text-sm font-medium text-white transition hover:bg-forest-600 disabled:opacity-50"
            >
              {saving ? "Saving..." : "Save Attendance"}
            </button>
            {saved && (
              <span className="text-sm text-green-600">Saved!</span>
            )}
          </div>
        </>
      )}
    </div>
  );
}
