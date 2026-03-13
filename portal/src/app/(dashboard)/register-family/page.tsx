"use client";

import { useSession } from "next-auth/react";
import { useEffect, useState, useRef, useCallback } from "react";

interface ChildForm {
  firstName: string;
  lastName: string;
  dateOfBirth: string;
  gender: string;
  daysInterested: string[];
  staffNotes: string;
}

const WEEKDAYS = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday"];

const emptyChild: ChildForm = {
  firstName: "",
  lastName: "",
  dateOfBirth: "",
  gender: "",
  daysInterested: [],
  staffNotes: "",
};

export default function RegisterFamilyPage() {
  const { data: session } = useSession();
  const [step, setStep] = useState(1);
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [saved, setSaved] = useState(false);
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const [guardian, setGuardian] = useState({
    fullName: "",
    email: "",
    phone: "",
    altPhone: "",
    relationship: "mother" as string,
    occupation: "",
  });

  const [address, setAddress] = useState({
    addressLine1: "",
    addressLine2: "",
    city: "",
    state: "CA",
    zip: "",
    country: "US",
  });

  const [children, setChildren] = useState<ChildForm[]>([{ ...emptyChild }]);

  // Load from localStorage on mount
  useEffect(() => {
    const draft = localStorage.getItem("lsk-reg-draft");
    if (draft) {
      try {
        const d = JSON.parse(draft);
        if (d.guardian) setGuardian(d.guardian);
        if (d.address) setAddress(d.address);
        if (d.children?.length) setChildren(d.children);
        if (d.step) setStep(d.step);
      } catch { /* ignore corrupt data */ }
    }
  }, []);

  useEffect(() => {
    if (session?.user) {
      setGuardian((g) => ({
        ...g,
        fullName: g.fullName || session.user.name || "",
        email: g.email || session.user.email || "",
      }));
    }
  }, [session]);

  // Auto-save to localStorage on any change (debounced)
  const autoSave = useCallback(() => {
    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(() => {
      localStorage.setItem(
        "lsk-reg-draft",
        JSON.stringify({ guardian, address, children, step })
      );
      setSaved(true);
      setTimeout(() => setSaved(false), 1500);
    }, 800);
  }, [guardian, address, children, step]);

  useEffect(() => {
    autoSave();
    return () => {
      if (saveTimer.current) clearTimeout(saveTimer.current);
    };
  }, [autoSave]);

  function updateChild(index: number, field: string, value: string | string[]) {
    setChildren((prev) =>
      prev.map((c, i) => (i === index ? { ...c, [field]: value } : c))
    );
  }

  function toggleDay(childIndex: number, day: string) {
    setChildren((prev) =>
      prev.map((c, i) => {
        if (i !== childIndex) return c;
        const days = c.daysInterested.includes(day)
          ? c.daysInterested.filter((d) => d !== day)
          : [...c.daysInterested, day];
        return { ...c, daysInterested: days };
      })
    );
  }

  function addChild() {
    setChildren((prev) => [...prev, { ...emptyChild }]);
  }

  function removeChild(index: number) {
    if (children.length > 1) {
      setChildren((prev) => prev.filter((_, i) => i !== index));
    }
  }

  function validateStep(s: number): boolean {
    setError("");
    if (s === 1) {
      if (!guardian.fullName || !guardian.email || !guardian.phone) {
        setError("Please fill in all required fields");
        return false;
      }
    }
    if (s === 2) {
      if (!address.addressLine1 || !address.city || !address.state || !address.zip) {
        setError("Please fill in all required fields");
        return false;
      }
    }
    if (s === 3) {
      for (const child of children) {
        if (!child.firstName || !child.lastName || !child.dateOfBirth) {
          setError("Please fill in all required fields for each child");
          return false;
        }
        if (child.daysInterested.length === 0) {
          setError("Please select at least one day for each child");
          return false;
        }
        if (new Date(child.dateOfBirth) > new Date()) {
          setError("Date of birth cannot be in the future");
          return false;
        }
      }
    }
    return true;
  }

  function nextStep() {
    if (validateStep(step)) {
      setStep((s) => s + 1);
    }
  }

  async function handleSubmit() {
    setError("");
    setSubmitting(true);

    const res = await fetch("/portal/api/registrations", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ guardian, address, children }),
    });

    const data = await res.json();

    if (!res.ok) {
      setError(data.error || "Submission failed");
      setSubmitting(false);
      return;
    }

    localStorage.removeItem("lsk-reg-draft");
    window.location.href = "/portal/dashboard";
  }

  const stepTitles = ["Contact Info", "Address", "Children", "Review"];
  const inputCls = "w-full rounded-lg border border-paper-300 bg-paper-50 px-3 py-2.5 text-base text-forest-900 outline-none focus:border-forest-500 focus:ring-2 focus:ring-forest-200";
  const inputWhiteCls = "w-full rounded-lg border border-paper-300 bg-white px-3 py-2.5 text-base text-forest-900 outline-none focus:border-forest-500 focus:ring-2 focus:ring-forest-200";

  return (
    <div className="pb-8">
      <div className="mb-1 flex items-center justify-between">
        <h1 className="text-xl font-bold text-forest-900 md:text-2xl">
          Family Pre-Registration
        </h1>
        {saved && (
          <span className="text-xs text-green-600">Draft saved</span>
        )}
      </div>
      <p className="mb-6 text-sm text-forest-600">
        Register your family for Lost Sierra Kids programs
      </p>

      {/* Step indicators */}
      <div className="mb-6 flex items-center gap-1.5 md:gap-2">
        {stepTitles.map((title, i) => (
          <div key={title} className="flex items-center gap-1.5 md:gap-2">
            <button
              type="button"
              onClick={() => {
                if (i + 1 < step) setStep(i + 1);
              }}
              className={`flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full text-sm font-medium transition ${
                i + 1 <= step
                  ? "bg-forest-800 text-white"
                  : "bg-paper-200 text-forest-500"
              } ${i + 1 < step ? "cursor-pointer hover:bg-forest-700" : ""}`}
            >
              {i + 1 < step ? (
                <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                </svg>
              ) : (
                i + 1
              )}
            </button>
            <span className={`hidden text-sm md:inline ${i + 1 === step ? "font-medium text-forest-800" : "text-forest-500"}`}>
              {title}
            </span>
            {i < 3 && <div className="h-px w-3 bg-paper-300 md:w-6" />}
          </div>
        ))}
      </div>

      {error && (
        <div className="mb-4 rounded-lg bg-red-50 p-3 text-sm text-red-700">
          {error}
        </div>
      )}

      <div className="rounded-xl border border-paper-200 bg-white p-4 md:p-8">
        {/* Step 1: Contact Info */}
        {step === 1 && (
          <div>
            <h2 className="mb-4 text-lg font-semibold text-forest-900">
              Contact Information
            </h2>
            <div className="grid gap-4 md:grid-cols-2">
              <div>
                <label className="mb-1 block text-sm font-medium text-forest-800">Full Name *</label>
                <input type="text" value={guardian.fullName} onChange={(e) => setGuardian({ ...guardian, fullName: e.target.value })} className={inputCls} autoComplete="name" />
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium text-forest-800">Email *</label>
                <input type="email" value={guardian.email} onChange={(e) => setGuardian({ ...guardian, email: e.target.value })} className={inputCls} autoComplete="email" />
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium text-forest-800">Phone *</label>
                <input type="tel" value={guardian.phone} onChange={(e) => setGuardian({ ...guardian, phone: e.target.value })} className={inputCls} autoComplete="tel" />
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium text-forest-800">Alternate Phone</label>
                <input type="tel" value={guardian.altPhone} onChange={(e) => setGuardian({ ...guardian, altPhone: e.target.value })} className={inputCls} />
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium text-forest-800">Relationship to Children *</label>
                <select value={guardian.relationship} onChange={(e) => setGuardian({ ...guardian, relationship: e.target.value })} className={inputCls}>
                  <option value="mother">Mother</option>
                  <option value="father">Father</option>
                  <option value="guardian">Guardian</option>
                  <option value="grandparent">Grandparent</option>
                  <option value="other">Other</option>
                </select>
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium text-forest-800">Occupation</label>
                <input type="text" value={guardian.occupation} onChange={(e) => setGuardian({ ...guardian, occupation: e.target.value })} className={inputCls} />
              </div>
            </div>
          </div>
        )}

        {/* Step 2: Address */}
        {step === 2 && (
          <div>
            <h2 className="mb-4 text-lg font-semibold text-forest-900">Home Address</h2>
            <div className="grid gap-4">
              <div>
                <label className="mb-1 block text-sm font-medium text-forest-800">Address Line 1 *</label>
                <input type="text" value={address.addressLine1} onChange={(e) => setAddress({ ...address, addressLine1: e.target.value })} className={inputCls} autoComplete="address-line1" />
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium text-forest-800">Address Line 2</label>
                <input type="text" value={address.addressLine2} onChange={(e) => setAddress({ ...address, addressLine2: e.target.value })} className={inputCls} autoComplete="address-line2" />
              </div>
              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="mb-1 block text-sm font-medium text-forest-800">City *</label>
                  <input type="text" value={address.city} onChange={(e) => setAddress({ ...address, city: e.target.value })} className={inputCls} autoComplete="address-level2" />
                </div>
                <div>
                  <label className="mb-1 block text-sm font-medium text-forest-800">State *</label>
                  <input type="text" value={address.state} onChange={(e) => setAddress({ ...address, state: e.target.value })} className={inputCls} autoComplete="address-level1" />
                </div>
                <div>
                  <label className="mb-1 block text-sm font-medium text-forest-800">ZIP *</label>
                  <input type="text" value={address.zip} onChange={(e) => setAddress({ ...address, zip: e.target.value })} className={inputCls} autoComplete="postal-code" inputMode="numeric" />
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Step 3: Children */}
        {step === 3 && (
          <div>
            <h2 className="mb-4 text-lg font-semibold text-forest-900">Children</h2>
            {children.map((child, i) => (
              <div key={i} className="mb-4 rounded-lg border border-paper-200 bg-paper-50 p-3 md:p-4">
                <div className="mb-3 flex items-center justify-between">
                  <h3 className="font-medium text-forest-800">Child {i + 1}</h3>
                  {children.length > 1 && (
                    <button type="button" onClick={() => removeChild(i)} className="text-sm text-red-600 active:text-red-800">
                      Remove
                    </button>
                  )}
                </div>
                <div className="grid gap-3 md:grid-cols-2">
                  <div>
                    <label className="mb-1 block text-sm font-medium text-forest-800">First Name *</label>
                    <input type="text" value={child.firstName} onChange={(e) => updateChild(i, "firstName", e.target.value)} className={inputWhiteCls} autoComplete="given-name" />
                  </div>
                  <div>
                    <label className="mb-1 block text-sm font-medium text-forest-800">Last Name *</label>
                    <input type="text" value={child.lastName} onChange={(e) => updateChild(i, "lastName", e.target.value)} className={inputWhiteCls} autoComplete="family-name" />
                  </div>
                  <div>
                    <label className="mb-1 block text-sm font-medium text-forest-800">Date of Birth *</label>
                    <input type="date" value={child.dateOfBirth} onChange={(e) => updateChild(i, "dateOfBirth", e.target.value)} className={inputWhiteCls} />
                  </div>
                  <div>
                    <label className="mb-1 block text-sm font-medium text-forest-800">Gender</label>
                    <select value={child.gender} onChange={(e) => updateChild(i, "gender", e.target.value)} className={inputWhiteCls}>
                      <option value="">Select...</option>
                      <option value="male">Male</option>
                      <option value="female">Female</option>
                      <option value="other">Other</option>
                    </select>
                  </div>

                  {/* Days Interested */}
                  <div className="md:col-span-2">
                    <label className="mb-2 block text-sm font-medium text-forest-800">Days Interested in Attending *</label>
                    <div className="grid grid-cols-5 gap-1.5 md:flex md:gap-2">
                      {WEEKDAYS.map((day) => {
                        const selected = child.daysInterested.includes(day.toLowerCase());
                        return (
                          <button
                            key={day}
                            type="button"
                            onClick={() => toggleDay(i, day.toLowerCase())}
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

                  {/* Notes for Staff */}
                  <div className="md:col-span-2">
                    <label className="mb-1 block text-sm font-medium text-forest-800">Notes for Staff</label>
                    <textarea
                      value={child.staffNotes}
                      onChange={(e) => updateChild(i, "staffNotes", e.target.value)}
                      rows={2}
                      placeholder="Anything the staff should know about your child..."
                      className={inputWhiteCls}
                    />
                  </div>
                </div>
              </div>
            ))}
            <button
              type="button"
              onClick={addChild}
              className="w-full rounded-lg border border-dashed border-forest-400 px-4 py-2.5 text-sm font-medium text-forest-600 transition active:bg-forest-50"
            >
              + Add Another Child
            </button>
          </div>
        )}

        {/* Step 4: Review */}
        {step === 4 && (
          <div>
            <h2 className="mb-4 text-lg font-semibold text-forest-900">Review Your Information</h2>

            <div className="mb-4">
              <div className="mb-1 flex items-center justify-between">
                <h3 className="text-sm font-semibold uppercase tracking-wider text-forest-500">Contact</h3>
                <button type="button" onClick={() => setStep(1)} className="text-xs font-medium text-forest-600 active:text-forest-800">Edit</button>
              </div>
              <div className="rounded-lg bg-paper-50 p-3 text-sm">
                <p><span className="font-medium">Name:</span> {guardian.fullName}</p>
                <p><span className="font-medium">Email:</span> {guardian.email}</p>
                <p><span className="font-medium">Phone:</span> {guardian.phone}</p>
                <p><span className="font-medium">Relationship:</span> {guardian.relationship}</p>
                {guardian.occupation && <p><span className="font-medium">Occupation:</span> {guardian.occupation}</p>}
              </div>
            </div>

            <div className="mb-4">
              <div className="mb-1 flex items-center justify-between">
                <h3 className="text-sm font-semibold uppercase tracking-wider text-forest-500">Address</h3>
                <button type="button" onClick={() => setStep(2)} className="text-xs font-medium text-forest-600 active:text-forest-800">Edit</button>
              </div>
              <div className="rounded-lg bg-paper-50 p-3 text-sm">
                <p>{address.addressLine1}</p>
                {address.addressLine2 && <p>{address.addressLine2}</p>}
                <p>{address.city}, {address.state} {address.zip}</p>
              </div>
            </div>

            <div>
              <div className="mb-1 flex items-center justify-between">
                <h3 className="text-sm font-semibold uppercase tracking-wider text-forest-500">Children ({children.length})</h3>
                <button type="button" onClick={() => setStep(3)} className="text-xs font-medium text-forest-600 active:text-forest-800">Edit</button>
              </div>
              {children.map((child, i) => (
                <div key={i} className="mb-2 rounded-lg bg-paper-50 p-3 text-sm">
                  <p className="font-medium">{child.firstName} {child.lastName}</p>
                  <p>DOB: {child.dateOfBirth}</p>
                  <p>Days: {child.daysInterested.map((d) => d.charAt(0).toUpperCase() + d.slice(1)).join(", ")}</p>
                  {child.staffNotes && <p>Staff Notes: {child.staffNotes}</p>}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Navigation buttons */}
        <div className="mt-6 flex justify-between gap-3">
          {step > 1 ? (
            <button
              type="button"
              onClick={() => setStep((s) => s - 1)}
              className="rounded-lg border border-paper-300 px-5 py-2.5 text-sm font-medium text-forest-600 transition active:bg-paper-100"
            >
              Back
            </button>
          ) : (
            <div />
          )}

          {step < 4 ? (
            <button
              type="button"
              onClick={nextStep}
              className="rounded-lg bg-forest-800 px-5 py-2.5 text-sm font-medium text-white transition active:bg-forest-700"
            >
              Continue
            </button>
          ) : (
            <button
              type="button"
              onClick={handleSubmit}
              disabled={submitting}
              className="rounded-lg bg-forest-800 px-5 py-2.5 text-sm font-medium text-white transition active:bg-forest-700 disabled:opacity-50"
            >
              {submitting ? "Submitting..." : "Submit Registration"}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
