"use client";

import { useEffect, useState } from "react";

interface Child {
  id: string;
  firstName: string;
  lastName: string;
  dateOfBirth: string;
  gender: string | null;
  allergies: string | null;
  medicalNotes: string | null;
  relationship: string;
}

export default function ChildrenPage() {
  const [children, setChildren] = useState<Child[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/children")
      .then((r) => r.json())
      .then((data) => {
        setChildren(data.children || []);
        setLoading(false);
      });
  }, []);

  if (loading) {
    return (
      <div className="flex h-64 items-center justify-center">
        <div className="text-forest-500">Loading...</div>
      </div>
    );
  }

  return (
    <div>
      <h1 className="mb-1 text-2xl font-bold text-forest-900">My Children</h1>
      <p className="mb-8 text-forest-600">
        Children linked to your family account
      </p>

      {children.length === 0 ? (
        <div className="rounded-xl border border-paper-200 bg-white p-8 text-center">
          <p className="text-forest-600">
            No children registered yet. Complete a family registration to add
            children.
          </p>
        </div>
      ) : (
        <div className="grid gap-4 md:grid-cols-2">
          {children.map((child) => (
            <div
              key={child.id}
              className="rounded-xl border border-paper-200 bg-white p-6"
            >
              <h3 className="mb-1 text-lg font-semibold text-forest-900">
                {child.firstName} {child.lastName}
              </h3>
              <div className="space-y-1 text-sm text-forest-600">
                <p>
                  Date of Birth:{" "}
                  {new Date(child.dateOfBirth).toLocaleDateString()}
                </p>
                {child.gender && (
                  <p>Gender: {child.gender}</p>
                )}
                <p>
                  Relationship:{" "}
                  {child.relationship.charAt(0).toUpperCase() +
                    child.relationship.slice(1)}
                </p>
                {child.allergies && (
                  <p className="text-red-600">
                    Allergies: {child.allergies}
                  </p>
                )}
                {child.medicalNotes && (
                  <p>Medical Notes: {child.medicalNotes}</p>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
