"use client";

import { useEffect, useState } from "react";

interface AttendanceRecord {
  id: string;
  date: string;
  status: string;
  notes: string | null;
  program: { name: string } | null;
}

interface ChildAttendance {
  child: { id: string; firstName: string; lastName: string };
  records: AttendanceRecord[];
}

export default function AttendancePage() {
  const [attendance, setAttendance] = useState<ChildAttendance[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    load();
  }, []);

  async function load() {
    const res = await fetch("/portal/api/attendance");
    const data = await res.json();
    setAttendance(data.attendance || []);
    setLoading(false);
  }

  if (loading) {
    return (
      <div className="flex h-64 items-center justify-center">
        <div className="text-forest-500">Loading...</div>
      </div>
    );
  }

  const statusColors: Record<string, string> = {
    present: "bg-green-100 text-green-700",
    absent: "bg-red-100 text-red-700",
    excused: "bg-yellow-100 text-yellow-700",
  };

  return (
    <div>
      <h1 className="mb-1 text-2xl font-bold text-forest-900">
        Attendance
      </h1>
      <p className="mb-8 text-forest-600">
        View attendance records for your children
      </p>

      {attendance.length === 0 ? (
        <div className="rounded-xl border border-paper-200 bg-white p-8 text-center text-forest-500">
          No attendance records yet
        </div>
      ) : (
        <div className="space-y-6">
          {attendance.map((ca) => {
            const total = ca.records.length;
            const present = ca.records.filter(
              (r) => r.status === "present"
            ).length;
            const rate = total > 0 ? Math.round((present / total) * 100) : 0;

            return (
              <div key={ca.child.id}>
                <div className="mb-3 flex items-center justify-between">
                  <h2 className="text-lg font-semibold text-forest-900">
                    {ca.child.firstName} {ca.child.lastName}
                  </h2>
                  <div className="text-sm text-forest-600">
                    {present}/{total} present ({rate}%)
                  </div>
                </div>

                <div className="rounded-xl border border-paper-200 bg-white">
                  {ca.records.length === 0 ? (
                    <div className="p-4 text-center text-sm text-forest-500">
                      No records yet
                    </div>
                  ) : (
                    ca.records
                      .sort(
                        (a, b) =>
                          new Date(b.date).getTime() -
                          new Date(a.date).getTime()
                      )
                      .slice(0, 20)
                      .map((r, i) => (
                        <div
                          key={r.id}
                          className={`flex items-center justify-between p-3 ${
                            i < Math.min(ca.records.length, 20) - 1
                              ? "border-b border-paper-100"
                              : ""
                          }`}
                        >
                          <div>
                            <div className="text-sm font-medium text-forest-800">
                              {new Date(r.date + "T00:00:00").toLocaleDateString(
                                undefined,
                                {
                                  weekday: "short",
                                  month: "short",
                                  day: "numeric",
                                }
                              )}
                            </div>
                            <div className="text-xs text-forest-500">
                              {r.program?.name}
                            </div>
                          </div>
                          <span
                            className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${
                              statusColors[r.status] ||
                              "bg-gray-100 text-gray-700"
                            }`}
                          >
                            {r.status}
                          </span>
                        </div>
                      ))
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
