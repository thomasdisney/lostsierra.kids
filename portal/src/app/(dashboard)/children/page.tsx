"use client";

import { useEffect, useState, useCallback, useRef } from "react";

interface Child {
  id: string;
  firstName: string;
  lastName: string;
  dateOfBirth: string;
  gender: string | null;
  daysInterested: string | null;
  staffNotes: string | null;
  relationship: string;
}

const WEEKDAYS = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday"];

export default function ChildrenPage() {
  const [children, setChildren] = useState<Child[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [savedMsg, setSavedMsg] = useState("");
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    fetch("/portal/api/children")
      .then((r) => r.json())
      .then((data) => {
        setChildren(data.children || []);
        setLoading(false);
      });
  }, []);

  const autoSaveChild = useCallback((child: Child) => {
    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(async () => {
      setSaving(true);
      await fetch("/portal/api/children", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: child.id,
          firstName: child.firstName,
          lastName: child.lastName,
          dateOfBirth: child.dateOfBirth,
          gender: child.gender,
          daysInterested: child.daysInterested,
          staffNotes: child.staffNotes,
        }),
      });
      setSaving(false);
      setSavedMsg("Saved");
      setTimeout(() => setSavedMsg(""), 1500);
    }, 1000);
  }, []);

  function updateChild(id: string, field: string, value: string | null) {
    setChildren((prev) => {
      const updated = prev.map((c) =>
        c.id === id ? { ...c, [field]: value } : c
      );
      const child = updated.find((c) => c.id === id);
      if (child) autoSaveChild(child);
      return updated;
    });
  }

  function toggleDay(id: string, day: string) {
    setChildren((prev) => {
      const updated = prev.map((c) => {
        if (c.id !== id) return c;
        const current = c.daysInterested ? c.daysInterested.split(",") : [];
        const newDays = current.includes(day)
          ? current.filter((d) => d !== day)
          : [...current, day];
        return { ...c, daysInterested: newDays.join(",") || null };
      });
      const child = updated.find((c) => c.id === id);
      if (child) autoSaveChild(child);
      return updated;
    });
  }

  if (loading) {
    return (
      <div>
        <div className="mb-2 h-7 w-36 animate-pulse rounded-lg bg-paper-200" />
        <div className="mb-6 h-4 w-56 animate-pulse rounded-lg bg-paper-200" />
        <div className="space-y-4">
          {[1, 2].map((i) => (
            <div key={i} className="h-20 animate-pulse rounded-xl bg-paper-100" />
          ))}
        </div>
      </div>
    );
  }

  const inputCls = "w-full rounded-lg border border-paper-300 bg-paper-50 px-3 py-2.5 text-base text-forest-900 outline-none focus:border-forest-500 focus:ring-2 focus:ring-forest-200";

  return (
    <div className="pb-8">
      <div className="mb-1 flex items-center justify-between">
        <h1 className="text-xl font-bold text-forest-900 md:text-2xl">My Children</h1>
        <span className="text-xs text-green-600">
          {saving ? "Saving..." : savedMsg}
        </span>
      </div>
      <p className="mb-6 text-sm text-forest-600">
        Tap a child to edit their information
      </p>

      {children.length === 0 ? (
        <div className="rounded-xl border border-paper-200 bg-white p-8 text-center">
          <p className="text-forest-600">
            No children registered yet. Complete a family registration to add children.
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          {children.map((child) => {
            const isEditing = editingId === child.id;
            const days = child.daysInterested ? child.daysInterested.split(",") : [];

            return (
              <div key={child.id} className="rounded-xl border border-paper-200 bg-white">
                {/* Card header - always visible */}
                <button
                  type="button"
                  onClick={() => setEditingId(isEditing ? null : child.id)}
                  className="flex w-full items-center justify-between p-4 text-left"
                >
                  <div>
                    <h3 className="text-lg font-semibold text-forest-900">
                      {child.firstName} {child.lastName}
                    </h3>
                    <p className="text-sm text-forest-500">
                      DOB: {new Date(child.dateOfBirth + "T00:00:00").toLocaleDateString()}
                      {days.length > 0 && (
                        <span> · {days.length} day{days.length !== 1 ? "s" : ""}/week</span>
                      )}
                    </p>
                  </div>
                  <svg
                    className={`h-5 w-5 flex-shrink-0 text-forest-400 transition ${isEditing ? "rotate-180" : ""}`}
                    fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}
                  >
                    <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
                  </svg>
                </button>

                {/* Expanded edit form */}
                {isEditing && (
                  <div className="border-t border-paper-200 p-4">
                    <div className="grid gap-3 md:grid-cols-2">
                      <div>
                        <label className="mb-1 block text-sm font-medium text-forest-800">First Name</label>
                        <input type="text" value={child.firstName} onChange={(e) => updateChild(child.id, "firstName", e.target.value)} className={inputCls} />
                      </div>
                      <div>
                        <label className="mb-1 block text-sm font-medium text-forest-800">Last Name</label>
                        <input type="text" value={child.lastName} onChange={(e) => updateChild(child.id, "lastName", e.target.value)} className={inputCls} />
                      </div>
                      <div>
                        <label className="mb-1 block text-sm font-medium text-forest-800">Date of Birth</label>
                        <input type="date" value={child.dateOfBirth} onChange={(e) => updateChild(child.id, "dateOfBirth", e.target.value)} className={inputCls} />
                      </div>
                      <div>
                        <label className="mb-1 block text-sm font-medium text-forest-800">Gender</label>
                        <select value={child.gender || ""} onChange={(e) => updateChild(child.id, "gender", e.target.value || null)} className={inputCls}>
                          <option value="">Select...</option>
                          <option value="male">Male</option>
                          <option value="female">Female</option>
                        </select>
                      </div>

                      {/* Days */}
                      <div className="md:col-span-2">
                        <label className="mb-2 block text-sm font-medium text-forest-800">Days Interested in Attending</label>
                        <div className="grid grid-cols-5 gap-1.5 md:flex md:gap-2">
                          {WEEKDAYS.map((day) => {
                            const selected = days.includes(day.toLowerCase());
                            return (
                              <button
                                key={day}
                                type="button"
                                onClick={() => toggleDay(child.id, day.toLowerCase())}
                                className={`rounded-lg border px-2 py-2.5 text-xs font-medium transition md:px-4 md:text-sm ${
                                  selected
                                    ? "border-forest-600 bg-forest-800 text-white"
                                    : "border-paper-300 bg-white text-forest-600 active:bg-forest-50"
                                }`}
                              >
                                <span className="md:hidden">{day.slice(0, 3)}</span>
                                <span className="hidden md:inline">{day}</span>
                              </button>
                            );
                          })}
                        </div>
                      </div>

                      {/* Staff Notes */}
                      <div className="md:col-span-2">
                        <label className="mb-1 block text-sm font-medium text-forest-800">Notes for Staff</label>
                        <textarea
                          value={child.staffNotes || ""}
                          onChange={(e) => updateChild(child.id, "staffNotes", e.target.value || null)}
                          rows={2}
                          placeholder="Anything the staff should know..."
                          className={inputCls}
                        />
                      </div>
                    </div>

                    <button
                      type="button"
                      onClick={() => setEditingId(null)}
                      className="mt-4 rounded-lg bg-forest-800 px-5 py-2 text-sm font-medium text-white active:bg-forest-700"
                    >
                      Done
                    </button>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
