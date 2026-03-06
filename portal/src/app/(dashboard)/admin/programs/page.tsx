"use client";

import { useEffect, useState } from "react";

interface Program {
  id: string;
  name: string;
  description: string | null;
  ageRange: string | null;
  active: boolean;
}

export default function AdminProgramsPage() {
  const [programs, setPrograms] = useState<Program[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ name: "", description: "", ageRange: "" });

  useEffect(() => {
    loadPrograms();
  }, []);

  async function loadPrograms() {
    const res = await fetch("/api/admin/programs");
    const data = await res.json();
    setPrograms(data.programs || []);
    setLoading(false);
  }

  async function createProgram(e: React.FormEvent) {
    e.preventDefault();
    await fetch("/api/admin/programs", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(form),
    });
    setForm({ name: "", description: "", ageRange: "" });
    setShowForm(false);
    loadPrograms();
  }

  async function toggleActive(program: Program) {
    await fetch("/api/admin/programs", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        id: program.id,
        name: program.name,
        description: program.description,
        ageRange: program.ageRange,
        active: !program.active,
      }),
    });
    loadPrograms();
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
          <h1 className="mb-1 text-2xl font-bold text-forest-900">Programs</h1>
          <p className="text-forest-600">Manage LSK programs</p>
        </div>
        <button
          onClick={() => setShowForm(!showForm)}
          className="rounded-lg bg-forest-800 px-4 py-2 text-sm font-medium text-white hover:bg-forest-700"
        >
          {showForm ? "Cancel" : "Add Program"}
        </button>
      </div>

      {showForm && (
        <form
          onSubmit={createProgram}
          className="mb-6 rounded-xl border border-paper-200 bg-white p-6"
        >
          <div className="grid gap-4 md:grid-cols-3">
            <div>
              <label className="mb-1 block text-sm font-medium text-forest-800">
                Name
              </label>
              <input
                type="text"
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                required
                className="w-full rounded-lg border border-paper-300 bg-paper-50 px-4 py-2.5 text-forest-900 outline-none focus:border-forest-500 focus:ring-2 focus:ring-forest-200"
              />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-forest-800">
                Age Range
              </label>
              <input
                type="text"
                value={form.ageRange}
                onChange={(e) => setForm({ ...form, ageRange: e.target.value })}
                placeholder="e.g. 5-7"
                className="w-full rounded-lg border border-paper-300 bg-paper-50 px-4 py-2.5 text-forest-900 outline-none focus:border-forest-500 focus:ring-2 focus:ring-forest-200"
              />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-forest-800">
                Description
              </label>
              <input
                type="text"
                value={form.description}
                onChange={(e) =>
                  setForm({ ...form, description: e.target.value })
                }
                className="w-full rounded-lg border border-paper-300 bg-paper-50 px-4 py-2.5 text-forest-900 outline-none focus:border-forest-500 focus:ring-2 focus:ring-forest-200"
              />
            </div>
          </div>
          <button
            type="submit"
            className="mt-4 rounded-lg bg-forest-800 px-4 py-2 text-sm font-medium text-white hover:bg-forest-700"
          >
            Create Program
          </button>
        </form>
      )}

      <div className="grid gap-4">
        {programs.map((program) => (
          <div
            key={program.id}
            className={`rounded-xl border bg-white p-6 ${
              program.active ? "border-paper-200" : "border-paper-200 opacity-60"
            }`}
          >
            <div className="flex items-start justify-between">
              <div>
                <h3 className="font-semibold text-forest-900">
                  {program.name}
                </h3>
                {program.ageRange && (
                  <p className="text-sm text-forest-500">
                    Ages {program.ageRange}
                  </p>
                )}
                {program.description && (
                  <p className="mt-1 text-sm text-forest-600">
                    {program.description}
                  </p>
                )}
              </div>
              <button
                onClick={() => toggleActive(program)}
                className={`rounded-full px-3 py-1 text-xs font-medium ${
                  program.active
                    ? "bg-green-100 text-green-800"
                    : "bg-gray-100 text-gray-600"
                }`}
              >
                {program.active ? "Active" : "Inactive"}
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
