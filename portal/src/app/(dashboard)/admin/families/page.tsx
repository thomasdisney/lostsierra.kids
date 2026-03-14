"use client";

import { useEffect, useState } from "react";

interface Guardian {
  fullName: string;
  email: string;
  phone: string | null;
  city: string | null;
  state: string | null;
}

interface Child {
  firstName: string;
  lastName: string;
  dateOfBirth: string;
  program: { name: string } | null;
}

interface Registration {
  id: string;
  status: string;
  guardian: Guardian;
  children: Child[];
}

export default function AdminFamiliesPage() {
  const [registrations, setRegistrations] = useState<Registration[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/portal/api/admin/registrations")
      .then((r) => r.json())
      .then((data) => {
        setRegistrations(data.registrations || []);
        setLoading(false);
      });
  }, []);

  if (loading) {
    return (
      <div>
        <div className="mb-2 h-7 w-44 animate-pulse rounded-lg bg-paper-200" />
        <div className="mb-8 h-4 w-56 animate-pulse rounded-lg bg-paper-200" />
        <div className="space-y-3">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-24 animate-pulse rounded-xl bg-paper-100" />
          ))}
        </div>
      </div>
    );
  }

  // Group by guardian
  const families = registrations.reduce(
    (acc, reg) => {
      const key = reg.guardian?.email || reg.id;
      if (!acc[key]) {
        acc[key] = { guardian: reg.guardian, children: [], statuses: [] };
      }
      acc[key].children.push(...(reg.children || []));
      acc[key].statuses.push(reg.status);
      return acc;
    },
    {} as Record<
      string,
      { guardian: Guardian; children: Child[]; statuses: string[] }
    >
  );

  return (
    <div>
      <h1 className="mb-1 text-2xl font-bold text-forest-900">
        All Families
      </h1>
      <p className="mb-8 text-forest-600">
        Overview of all registered families
      </p>

      <div className="grid gap-4">
        {Object.entries(families).map(([key, family]) => (
          <div
            key={key}
            className="rounded-xl border border-paper-200 bg-white p-6"
          >
            <div className="mb-3 flex items-start justify-between">
              <div>
                <h3 className="font-semibold text-forest-900">
                  {family.guardian?.fullName || "Unknown"}
                </h3>
                <p className="text-sm text-forest-500">
                  {family.guardian?.email}
                </p>
                {family.guardian?.phone && (
                  <p className="text-sm text-forest-500">
                    {family.guardian.phone}
                  </p>
                )}
              </div>
              <div className="text-right text-sm text-forest-500">
                {family.guardian?.city && family.guardian?.state
                  ? `${family.guardian.city}, ${family.guardian.state}`
                  : ""}
              </div>
            </div>
            {family.children.length > 0 && (
              <div className="border-t border-paper-100 pt-3">
                <div className="text-xs font-semibold uppercase text-forest-500 mb-2">
                  Children
                </div>
                {family.children.map((child, i) => (
                  <div key={i} className="text-sm text-forest-700">
                    {child.firstName} {child.lastName}
                    {child.program && ` - ${child.program.name}`}
                  </div>
                ))}
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
