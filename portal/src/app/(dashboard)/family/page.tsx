"use client";

import { useEffect, useState, useRef, useCallback } from "react";

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
  const [savedMsg, setSavedMsg] = useState("");
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    fetch("/portal/api/guardians")
      .then((r) => r.json())
      .then((data) => {
        setGuardian(data.guardian);
        setLoading(false);
      });
  }, []);

  const autoSave = useCallback((g: Guardian) => {
    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(async () => {
      setSaving(true);
      const res = await fetch("/portal/api/guardians", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(g),
      });
      setSaving(false);
      if (res.ok) {
        setSavedMsg("Saved");
        setTimeout(() => setSavedMsg(""), 1500);
      }
    }, 1000);
  }, []);

  function update(field: string, value: string) {
    if (!guardian) return;
    const updated = { ...guardian, [field]: value };
    setGuardian(updated);
    autoSave(updated);
  }

  if (loading) {
    return (
      <div>
        <div className="mb-2 h-7 w-40 animate-pulse rounded-lg bg-paper-200" />
        <div className="mb-6 h-4 w-48 animate-pulse rounded-lg bg-paper-200" />
        <div className="rounded-xl border border-paper-200 bg-white p-4 md:p-8">
          <div className="grid gap-4 md:grid-cols-2">
            {[1, 2, 3, 4].map((i) => (
              <div key={i} className="h-16 animate-pulse rounded-lg bg-paper-100" />
            ))}
          </div>
        </div>
      </div>
    );
  }

  if (!guardian) {
    return <div className="text-forest-600">No profile found.</div>;
  }

  const inputCls = "w-full rounded-lg border border-paper-300 bg-paper-50 px-3 py-2.5 text-base text-forest-900 outline-none focus:border-forest-500 focus:ring-2 focus:ring-forest-200";

  return (
    <div className="pb-8">
      <div className="mb-1 flex items-center justify-between">
        <h1 className="text-xl font-bold text-forest-900 md:text-2xl">Family Profile</h1>
        <span className="text-xs text-green-600">
          {saving ? "Saving..." : savedMsg}
        </span>
      </div>
      <p className="mb-6 text-sm text-forest-600">
        Changes are saved automatically
      </p>

      <div className="rounded-xl border border-paper-200 bg-white p-4 md:p-8">
        <h2 className="mb-4 text-lg font-semibold text-forest-900">Contact Information</h2>
        <div className="mb-6 grid gap-4 md:grid-cols-2">
          <div>
            <label className="mb-1 block text-sm font-medium text-forest-800">Full Name</label>
            <input type="text" value={guardian.fullName} onChange={(e) => update("fullName", e.target.value)} className={inputCls} autoComplete="name" />
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-forest-800">Email</label>
            <input type="email" value={guardian.email} disabled className="w-full rounded-lg border border-paper-300 bg-paper-200 px-3 py-2.5 text-base text-forest-500" />
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-forest-800">Phone</label>
            <input type="tel" value={guardian.phone || ""} onChange={(e) => update("phone", e.target.value)} className={inputCls} autoComplete="tel" />
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-forest-800">Alt Phone</label>
            <input type="tel" value={guardian.altPhone || ""} onChange={(e) => update("altPhone", e.target.value)} className={inputCls} />
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-forest-800">Occupation</label>
            <input type="text" value={guardian.occupation || ""} onChange={(e) => update("occupation", e.target.value)} className={inputCls} />
          </div>
        </div>

        <h2 className="mb-4 text-lg font-semibold text-forest-900">Address</h2>
        <div className="grid gap-4">
          <div>
            <label className="mb-1 block text-sm font-medium text-forest-800">Address Line 1</label>
            <input type="text" value={guardian.addressLine1 || ""} onChange={(e) => update("addressLine1", e.target.value)} className={inputCls} autoComplete="address-line1" />
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-forest-800">Address Line 2</label>
            <input type="text" value={guardian.addressLine2 || ""} onChange={(e) => update("addressLine2", e.target.value)} className={inputCls} autoComplete="address-line2" />
          </div>
          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className="mb-1 block text-sm font-medium text-forest-800">City</label>
              <input type="text" value={guardian.city || ""} onChange={(e) => update("city", e.target.value)} className={inputCls} autoComplete="address-level2" />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-forest-800">State</label>
              <input type="text" value={guardian.state || ""} onChange={(e) => update("state", e.target.value)} className={inputCls} autoComplete="address-level1" />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-forest-800">ZIP</label>
              <input type="text" value={guardian.zip || ""} onChange={(e) => update("zip", e.target.value)} className={inputCls} autoComplete="postal-code" inputMode="numeric" />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
