"use client";

import { useEffect, useState } from "react";

interface Child {
  id: string;
  firstName: string;
  lastName: string;
  dateOfBirth: string;
  daysInterested: string | null;
  allergies: string | null;
  medicalNotes: string | null;
  staffNotes: string | null;
  program: { name: string } | null;
}

interface Guardian {
  fullName: string;
  email: string;
  phone: string;
  city: string;
  state: string;
}

interface Registration {
  id: string;
  status: string;
  submittedAt: string;
  adminNotes: string | null;
  guardian: Guardian;
  children: Child[];
}

const statusColors: Record<string, string> = {
  submitted: "bg-blue-100 text-blue-800",
  under_review: "bg-yellow-100 text-yellow-800",
  approved: "bg-green-100 text-green-800",
  rejected: "bg-red-100 text-red-800",
};

export default function AdminRegistrationsPage() {
  const [registrations, setRegistrations] = useState<Registration[]>([]);
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState<string | null>(null);

  useEffect(() => {
    loadRegistrations();
  }, []);

  async function loadRegistrations() {
    const res = await fetch("/portal/api/admin/registrations");
    const data = await res.json();
    setRegistrations(data.registrations || []);
    setLoading(false);
  }

  async function updateStatus(id: string, status: string) {
    await fetch("/portal/api/admin/registrations", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id, status }),
    });
    loadRegistrations();
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
        All Registrations
      </h1>
      <p className="mb-8 text-forest-600">
        Review and manage family pre-registrations
      </p>

      {registrations.length === 0 ? (
        <div className="rounded-xl border border-paper-200 bg-white p-8 text-center text-forest-600">
          No registrations yet.
        </div>
      ) : (
        <div className="space-y-4">
          {registrations.map((reg) => (
            <div
              key={reg.id}
              className="rounded-xl border border-paper-200 bg-white"
            >
              <button
                className="flex w-full items-center justify-between p-4 text-left"
                onClick={() =>
                  setExpanded(expanded === reg.id ? null : reg.id)
                }
              >
                <div>
                  <div className="font-medium text-forest-900">
                    {reg.guardian?.fullName || "Unknown"}
                  </div>
                  <div className="text-sm text-forest-500">
                    {reg.children?.length || 0} child(ren) &middot;{" "}
                    {new Date(reg.submittedAt).toLocaleDateString()}
                  </div>
                </div>
                <span
                  className={`rounded-full px-3 py-1 text-xs font-medium ${
                    statusColors[reg.status] || "bg-gray-100"
                  }`}
                >
                  {reg.status.replace("_", " ")}
                </span>
              </button>

              {expanded === reg.id && (
                <div className="border-t border-paper-200 p-4">
                  <div className="mb-4 grid gap-4 md:grid-cols-2">
                    <div>
                      <h4 className="mb-1 text-xs font-semibold uppercase text-forest-500">
                        Contact
                      </h4>
                      <p className="text-sm">
                        {reg.guardian?.email}
                      </p>
                      <p className="text-sm">{reg.guardian?.phone}</p>
                      <p className="text-sm">
                        {reg.guardian?.city}, {reg.guardian?.state}
                      </p>
                    </div>
                    <div>
                      <h4 className="mb-1 text-xs font-semibold uppercase text-forest-500">
                        Children
                      </h4>
                      {reg.children?.map((child) => (
                        <div key={child.id} className="mb-2 rounded-lg bg-paper-50 p-2 text-sm">
                          <p className="font-medium">{child.firstName} {child.lastName}</p>
                          <p>DOB: {child.dateOfBirth}</p>
                          {child.daysInterested && (
                            <p>Days: {child.daysInterested.split(",").map((d) => d.charAt(0).toUpperCase() + d.slice(1)).join(", ")}</p>
                          )}
                          {!child.daysInterested && child.program?.name && (
                            <p>Program: {child.program.name}</p>
                          )}
                          {child.allergies && (
                            <p className="text-red-600">Allergies: {child.allergies}</p>
                          )}
                          {child.medicalNotes && (
                            <p>Special Instructions: {child.medicalNotes}</p>
                          )}
                          {child.staffNotes && (
                            <p>Staff Notes: {child.staffNotes}</p>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                  <div className="flex gap-2">
                    {reg.status !== "approved" && (
                      <button
                        onClick={() => updateStatus(reg.id, "approved")}
                        className="rounded-lg bg-green-600 px-4 py-2 text-sm font-medium text-white hover:bg-green-700"
                      >
                        Approve
                      </button>
                    )}
                    {reg.status === "submitted" && (
                      <button
                        onClick={() => updateStatus(reg.id, "under_review")}
                        className="rounded-lg bg-yellow-500 px-4 py-2 text-sm font-medium text-white hover:bg-yellow-600"
                      >
                        Mark Under Review
                      </button>
                    )}
                    {reg.status !== "rejected" && (
                      <button
                        onClick={() => updateStatus(reg.id, "rejected")}
                        className="rounded-lg border border-red-300 px-4 py-2 text-sm font-medium text-red-600 hover:bg-red-50"
                      >
                        Reject
                      </button>
                    )}
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
