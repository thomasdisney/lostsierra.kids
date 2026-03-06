"use client";

import { useEffect, useState } from "react";

interface Guardian {
  id: string;
  fullName: string;
  email: string;
  phone: string | null;
  altPhone: string | null;
  occupation: string | null;
  addressLine1: string | null;
  addressLine2: string | null;
  city: string | null;
  state: string | null;
  zip: string | null;
  country: string | null;
}

export default function FamilyPage() {
  const [guardian, setGuardian] = useState<Guardian | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");

  useEffect(() => {
    fetch("/portal/api/guardians")
      .then((r) => r.json())
      .then((data) => {
        setGuardian(data.guardian);
        setLoading(false);
      });
  }, []);

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    if (!guardian) return;
    setSaving(true);
    setMessage("");

    const res = await fetch("/portal/api/guardians", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(guardian),
    });

    if (res.ok) {
      setMessage("Profile updated successfully");
    } else {
      setMessage("Failed to update profile");
    }
    setSaving(false);
  }

  if (loading) {
    return (
      <div className="flex h-64 items-center justify-center">
        <div className="text-forest-500">Loading...</div>
      </div>
    );
  }

  if (!guardian) {
    return <div className="text-forest-600">No profile found.</div>;
  }

  return (
    <div>
      <h1 className="mb-1 text-2xl font-bold text-forest-900">
        Family Profile
      </h1>
      <p className="mb-8 text-forest-600">
        Update your contact information and address
      </p>

      {message && (
        <div
          className={`mb-4 rounded-lg p-3 text-sm ${
            message.includes("success")
              ? "bg-green-50 text-green-700"
              : "bg-red-50 text-red-700"
          }`}
        >
          {message}
        </div>
      )}

      <form
        onSubmit={handleSave}
        className="rounded-xl border border-paper-200 bg-white p-6 md:p-8"
      >
        <h2 className="mb-6 text-lg font-semibold text-forest-900">
          Contact Information
        </h2>
        <div className="mb-8 grid gap-4 md:grid-cols-2">
          <div>
            <label className="mb-1 block text-sm font-medium text-forest-800">
              Full Name
            </label>
            <input
              type="text"
              value={guardian.fullName}
              onChange={(e) =>
                setGuardian({ ...guardian, fullName: e.target.value })
              }
              className="w-full rounded-lg border border-paper-300 bg-paper-50 px-4 py-2.5 text-forest-900 outline-none focus:border-forest-500 focus:ring-2 focus:ring-forest-200"
            />
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-forest-800">
              Email
            </label>
            <input
              type="email"
              value={guardian.email}
              disabled
              className="w-full rounded-lg border border-paper-300 bg-paper-200 px-4 py-2.5 text-forest-500"
            />
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-forest-800">
              Phone
            </label>
            <input
              type="tel"
              value={guardian.phone || ""}
              onChange={(e) =>
                setGuardian({ ...guardian, phone: e.target.value })
              }
              className="w-full rounded-lg border border-paper-300 bg-paper-50 px-4 py-2.5 text-forest-900 outline-none focus:border-forest-500 focus:ring-2 focus:ring-forest-200"
            />
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-forest-800">
              Alt Phone
            </label>
            <input
              type="tel"
              value={guardian.altPhone || ""}
              onChange={(e) =>
                setGuardian({ ...guardian, altPhone: e.target.value })
              }
              className="w-full rounded-lg border border-paper-300 bg-paper-50 px-4 py-2.5 text-forest-900 outline-none focus:border-forest-500 focus:ring-2 focus:ring-forest-200"
            />
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-forest-800">
              Occupation
            </label>
            <input
              type="text"
              value={guardian.occupation || ""}
              onChange={(e) =>
                setGuardian({ ...guardian, occupation: e.target.value })
              }
              className="w-full rounded-lg border border-paper-300 bg-paper-50 px-4 py-2.5 text-forest-900 outline-none focus:border-forest-500 focus:ring-2 focus:ring-forest-200"
            />
          </div>
        </div>

        <h2 className="mb-6 text-lg font-semibold text-forest-900">Address</h2>
        <div className="mb-8 grid gap-4">
          <div>
            <label className="mb-1 block text-sm font-medium text-forest-800">
              Address Line 1
            </label>
            <input
              type="text"
              value={guardian.addressLine1 || ""}
              onChange={(e) =>
                setGuardian({ ...guardian, addressLine1: e.target.value })
              }
              className="w-full rounded-lg border border-paper-300 bg-paper-50 px-4 py-2.5 text-forest-900 outline-none focus:border-forest-500 focus:ring-2 focus:ring-forest-200"
            />
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-forest-800">
              Address Line 2
            </label>
            <input
              type="text"
              value={guardian.addressLine2 || ""}
              onChange={(e) =>
                setGuardian({ ...guardian, addressLine2: e.target.value })
              }
              className="w-full rounded-lg border border-paper-300 bg-paper-50 px-4 py-2.5 text-forest-900 outline-none focus:border-forest-500 focus:ring-2 focus:ring-forest-200"
            />
          </div>
          <div className="grid gap-4 md:grid-cols-3">
            <div>
              <label className="mb-1 block text-sm font-medium text-forest-800">
                City
              </label>
              <input
                type="text"
                value={guardian.city || ""}
                onChange={(e) =>
                  setGuardian({ ...guardian, city: e.target.value })
                }
                className="w-full rounded-lg border border-paper-300 bg-paper-50 px-4 py-2.5 text-forest-900 outline-none focus:border-forest-500 focus:ring-2 focus:ring-forest-200"
              />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-forest-800">
                State
              </label>
              <input
                type="text"
                value={guardian.state || ""}
                onChange={(e) =>
                  setGuardian({ ...guardian, state: e.target.value })
                }
                className="w-full rounded-lg border border-paper-300 bg-paper-50 px-4 py-2.5 text-forest-900 outline-none focus:border-forest-500 focus:ring-2 focus:ring-forest-200"
              />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-forest-800">
                ZIP
              </label>
              <input
                type="text"
                value={guardian.zip || ""}
                onChange={(e) =>
                  setGuardian({ ...guardian, zip: e.target.value })
                }
                className="w-full rounded-lg border border-paper-300 bg-paper-50 px-4 py-2.5 text-forest-900 outline-none focus:border-forest-500 focus:ring-2 focus:ring-forest-200"
              />
            </div>
          </div>
        </div>

        <button
          type="submit"
          disabled={saving}
          className="rounded-lg bg-forest-800 px-6 py-2.5 font-medium text-white transition hover:bg-forest-700 disabled:opacity-50"
        >
          {saving ? "Saving..." : "Save Changes"}
        </button>
      </form>
    </div>
  );
}
