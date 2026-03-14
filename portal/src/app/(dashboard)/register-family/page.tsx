"use client";

import { useSession } from "next-auth/react";
import { useEffect, useState, useRef } from "react";

interface CoParentForm {
  fullName: string;
  email: string;
  phone: string;
  relationship: string;
}

const emptyCoParent: CoParentForm = {
  fullName: "",
  email: "",
  phone: "",
  relationship: "",
};

interface ChildForm {
  firstName: string;
  lastName: string;
  dateOfBirth: string;
  gender: string;
  daysInterested: string[];
  desiredStartDate: string;
  hoursNeeded: string;
  staffNotes: string;
}

const WEEKDAYS = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday"];

const emptyChild: ChildForm = {
  firstName: "",
  lastName: "",
  dateOfBirth: "",
  gender: "",
  daysInterested: [],
  desiredStartDate: "",
  hoursNeeded: "",
  staffNotes: "",
};

export default function RegisterFamilyPage() {
  const { data: session, status } = useSession();
  const [step, setStep] = useState(1);
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [saving, setSaving] = useState(false);
  const [savedMsg, setSavedMsg] = useState("");
  const [ready, setReady] = useState(false);

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

  const [coParents, setCoParents] = useState<CoParentForm[]>([]);
  const [children, setChildren] = useState<ChildForm[]>([{ ...emptyChild }]);

  // Refs for debounced DB save
  const guardianRef = useRef(guardian);
  const addressRef = useRef(address);
  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  guardianRef.current = guardian;
  addressRef.current = address;

  // Load guardian data from database on mount (the only data source)
  useEffect(() => {
    if (status === "loading") return;

    async function loadFromDB() {
      try {
        const res = await fetch("/portal/api/guardians");
        const data = await res.json();
        const g = data.guardian;

        if (g) {
          setGuardian({
            fullName: g.fullName || session?.user?.name || "",
            email: g.email || session?.user?.email || "",
            phone: g.phone || "",
            altPhone: g.altPhone || "",
            relationship: "mother",
            occupation: g.occupation || "",
          });
          setAddress({
            addressLine1: g.addressLine1 || "",
            addressLine2: g.addressLine2 || "",
            city: g.city || "",
            state: g.state || "CA",
            zip: g.zip || "",
            country: g.country || "US",
          });
        } else if (session?.user) {
          setGuardian((prev) => ({
            ...prev,
            fullName: session.user.name || "",
            email: session.user.email || "",
          }));
        }
      } catch {
        // If API fails, just use session name/email
        if (session?.user) {
          setGuardian((prev) => ({
            ...prev,
            fullName: session.user.name || "",
            email: session.user.email || "",
          }));
        }
      }
      setReady(true);
    }

    loadFromDB();
  }, [session, status]);

  // Auto-save guardian/address to database (debounced)
  function scheduleSave() {
    if (!ready) return;
    if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    saveTimerRef.current = setTimeout(async () => {
      setSaving(true);
      try {
        await fetch("/portal/api/guardians", {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            fullName: guardianRef.current.fullName,
            phone: guardianRef.current.phone,
            altPhone: guardianRef.current.altPhone,
            occupation: guardianRef.current.occupation,
            addressLine1: addressRef.current.addressLine1,
            addressLine2: addressRef.current.addressLine2,
            city: addressRef.current.city,
            state: addressRef.current.state,
            zip: addressRef.current.zip,
            country: addressRef.current.country,
          }),
        });
        setSavedMsg("Saved");
        setTimeout(() => setSavedMsg(""), 1500);
      } catch { /* silently fail */ }
      setSaving(false);
    }, 1200);
  }

  function setGuardianAndSave(g: typeof guardian) {
    setGuardian(g);
    guardianRef.current = g;
    scheduleSave();
  }

  function setAddressAndSave(a: typeof address) {
    setAddress(a);
    addressRef.current = a;
    scheduleSave();
  }

  function updateCoParent(index: number, field: string, value: string) {
    setCoParents((prev) =>
      prev.map((cp, i) => (i === index ? { ...cp, [field]: value } : cp))
    );
  }

  function addCoParent() {
    setCoParents((prev) => [...prev, { ...emptyCoParent }]);
  }

  function removeCoParent(index: number) {
    setCoParents((prev) => prev.filter((_, i) => i !== index));
  }

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

  function validateStep(s: number): string {
    if (s === 1) {
      if (!guardian.fullName) return "Full Name is required";
      if (!guardian.email) return "Email is required";
      if (!guardian.phone) return "Phone is required";
    }
    if (s === 2) {
      if (!address.addressLine1) return "Address is required";
      if (!address.city) return "City is required";
      if (!address.state) return "State is required";
      if (!address.zip) return "ZIP Code is required";
    }
    if (s === 3) {
      for (let idx = 0; idx < children.length; idx++) {
        const child = children[idx];
        const label = children.length > 1 ? ` for Child ${idx + 1}` : "";
        if (!child.firstName) return `First Name is required${label}`;
        if (!child.lastName) return `Last Name is required${label}`;
        if (!child.dateOfBirth) return `Date of Birth is required${label}`;
        if (child.daysInterested.length === 0) return `Select at least one day${label}`;
        if (new Date(child.dateOfBirth) > new Date()) return `Date of birth cannot be in the future${label}`;
      }
    }
    return "";
  }

  function nextStep() {
    const err = validateStep(step);
    setError(err);
    if (!err) setStep((s) => s + 1);
  }

  async function handleSubmit() {
    setError("");
    setSubmitting(true);

    const res = await fetch("/portal/api/registrations", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ guardian, address, children, coParents }),
    });

    const data = await res.json();

    if (!res.ok) {
      setError(data.error || "Submission failed");
      setSubmitting(false);
      return;
    }

    window.location.href = "/portal/dashboard";
  }

  if (!ready) {
    return (
      <div>
        <div className="mb-2 h-7 w-52 animate-pulse rounded-lg bg-paper-200" />
        <div className="mb-6 h-4 w-72 animate-pulse rounded-lg bg-paper-200" />
        <div className="mb-6 flex items-center gap-2">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="h-8 w-8 animate-pulse rounded-full bg-paper-200" />
          ))}
        </div>
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

  const stepTitles = ["Contact Info", "Address", "Children", "Review"];
  const inputCls = "w-full rounded-lg border border-paper-300 bg-paper-50 px-3 py-2.5 text-base text-forest-900 outline-none focus:border-forest-500 focus:ring-2 focus:ring-forest-200";
  const inputWhiteCls = "w-full rounded-lg border border-paper-300 bg-white px-3 py-2.5 text-base text-forest-900 outline-none focus:border-forest-500 focus:ring-2 focus:ring-forest-200";

  return (
    <div className="pb-8">
      <div className="mb-1 flex items-center justify-between">
        <h1 className="text-xl font-bold text-forest-900 md:text-2xl">
          Family Pre-Registration
        </h1>
        <span className="text-xs text-green-600">
          {saving ? "Saving..." : savedMsg}
        </span>
      </div>
      <p className="mb-6 text-sm text-forest-600">
        Pre-register your family for Lost Sierra Kids programs. This is not a firm commitment.
      </p>

      {/* Step indicators */}
      <div className="mb-6 flex items-center gap-1.5 md:gap-2">
        {stepTitles.map((title, i) => (
          <div key={title} className="flex items-center gap-1.5 md:gap-2">
            <button
              type="button"
              onClick={() => { if (i + 1 < step) setStep(i + 1); }}
              className={`flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full text-sm font-medium transition ${
                i + 1 <= step ? "bg-forest-800 text-white" : "bg-paper-200 text-forest-500"
              } ${i + 1 < step ? "cursor-pointer hover:bg-forest-700" : ""}`}
            >
              {i + 1 < step ? (
                <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                </svg>
              ) : (i + 1)}
            </button>
            <span className={`hidden text-sm md:inline ${i + 1 === step ? "font-medium text-forest-800" : "text-forest-500"}`}>
              {title}
            </span>
            {i < 3 && <div className="h-px w-3 bg-paper-300 md:w-6" />}
          </div>
        ))}
      </div>

      {/* Error at top */}
      {error && (
        <div className="mb-4 rounded-lg bg-red-50 p-3 text-sm text-red-700">{error}</div>
      )}

      <div className="rounded-xl border border-paper-200 bg-white p-4 md:p-8">
        {/* Step 1: Contact Info */}
        {step === 1 && (
          <div>
            <h2 className="mb-4 text-lg font-semibold text-forest-900">Contact Information</h2>
            <div className="grid gap-4 md:grid-cols-2">
              <div>
                <label className="mb-1 block text-sm font-medium text-forest-800">Full Name *</label>
                <input type="text" value={guardian.fullName} onChange={(e) => setGuardianAndSave({ ...guardian, fullName: e.target.value })} className={inputCls} autoComplete="on" />
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium text-forest-800">Email *</label>
                <input type="email" value={guardian.email} onChange={(e) => setGuardianAndSave({ ...guardian, email: e.target.value })} className={inputCls} autoComplete="on" />
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium text-forest-800">Phone *</label>
                <input type="tel" value={guardian.phone} onChange={(e) => setGuardianAndSave({ ...guardian, phone: e.target.value })} className={inputCls} autoComplete="on" />
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium text-forest-800">Alternate Phone</label>
                <input type="tel" value={guardian.altPhone} onChange={(e) => setGuardianAndSave({ ...guardian, altPhone: e.target.value })} className={inputCls} autoComplete="on" />
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium text-forest-800">Relationship to Children *</label>
                <select value={guardian.relationship} onChange={(e) => setGuardianAndSave({ ...guardian, relationship: e.target.value })} className={inputCls}>
                  <option value="mother">Mother</option>
                  <option value="father">Father</option>
                  <option value="guardian">Guardian</option>
                  <option value="grandparent">Grandparent</option>
                  <option value="other">Other</option>
                </select>
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium text-forest-800">Occupation</label>
                <input type="text" value={guardian.occupation} onChange={(e) => setGuardianAndSave({ ...guardian, occupation: e.target.value })} className={inputCls} autoComplete="on" />
              </div>
            </div>

            {/* Co-Parents */}
            <div className="mt-6 border-t border-paper-200 pt-5">
              <div className="mb-3 flex items-center justify-between">
                <h3 className="text-base font-semibold text-forest-900">Co-Parents / Additional Contacts</h3>
              </div>
              {coParents.map((cp, i) => (
                <div key={i} className="mb-3 rounded-lg border border-paper-200 bg-paper-50 p-3">
                  <div className="mb-2 flex items-center justify-between">
                    <span className="text-sm font-medium text-forest-700">Co-Parent {i + 1}</span>
                    <button type="button" onClick={() => removeCoParent(i)} className="text-xs text-red-600 active:text-red-800">Remove</button>
                  </div>
                  <div className="grid gap-3 md:grid-cols-2">
                    <div>
                      <label className="mb-1 block text-xs font-medium text-forest-700">Full Name</label>
                      <input type="text" value={cp.fullName} onChange={(e) => updateCoParent(i, "fullName", e.target.value)} className={inputWhiteCls} placeholder="Name" />
                    </div>
                    <div>
                      <label className="mb-1 block text-xs font-medium text-forest-700">Email</label>
                      <input type="email" value={cp.email} onChange={(e) => updateCoParent(i, "email", e.target.value)} className={inputWhiteCls} placeholder="Email" />
                    </div>
                    <div>
                      <label className="mb-1 block text-xs font-medium text-forest-700">Phone</label>
                      <input type="tel" value={cp.phone} onChange={(e) => updateCoParent(i, "phone", e.target.value)} className={inputWhiteCls} placeholder="Phone" />
                    </div>
                    <div>
                      <label className="mb-1 block text-xs font-medium text-forest-700">Relationship</label>
                      <select value={cp.relationship} onChange={(e) => updateCoParent(i, "relationship", e.target.value)} className={inputWhiteCls}>
                        <option value="">Select...</option>
                        <option value="mother">Mother</option>
                        <option value="father">Father</option>
                        <option value="guardian">Guardian</option>
                        <option value="grandparent">Grandparent</option>
                        <option value="other">Other</option>
                      </select>
                    </div>
                  </div>
                </div>
              ))}
              <button
                type="button"
                onClick={addCoParent}
                className="w-full rounded-lg border border-dashed border-forest-400 px-4 py-2 text-sm font-medium text-forest-600 transition active:bg-forest-50"
              >
                + Add Co-Parent
              </button>
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
                <input type="text" value={address.addressLine1} onChange={(e) => setAddressAndSave({ ...address, addressLine1: e.target.value })} className={inputCls} autoComplete="on" />
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium text-forest-800">Address Line 2</label>
                <input type="text" value={address.addressLine2} onChange={(e) => setAddressAndSave({ ...address, addressLine2: e.target.value })} className={inputCls} autoComplete="on" />
              </div>
              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="mb-1 block text-sm font-medium text-forest-800">City *</label>
                  <input type="text" value={address.city} onChange={(e) => setAddressAndSave({ ...address, city: e.target.value })} className={inputCls} autoComplete="on" />
                </div>
                <div>
                  <label className="mb-1 block text-sm font-medium text-forest-800">State *</label>
                  <input type="text" value={address.state} onChange={(e) => setAddressAndSave({ ...address, state: e.target.value })} className={inputCls} autoComplete="on" />
                </div>
                <div>
                  <label className="mb-1 block text-sm font-medium text-forest-800">ZIP *</label>
                  <input type="text" value={address.zip} onChange={(e) => setAddressAndSave({ ...address, zip: e.target.value })} className={inputCls} autoComplete="on" inputMode="numeric" />
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
                    <button type="button" onClick={() => removeChild(i)} className="text-sm text-red-600 active:text-red-800">Remove</button>
                  )}
                </div>
                <div className="grid gap-3 md:grid-cols-2">
                  <div>
                    <label className="mb-1 block text-sm font-medium text-forest-800">First Name *</label>
                    <input type="text" value={child.firstName} onChange={(e) => updateChild(i, "firstName", e.target.value)} className={inputWhiteCls} autoComplete="on" />
                  </div>
                  <div>
                    <label className="mb-1 block text-sm font-medium text-forest-800">Last Name *</label>
                    <input type="text" value={child.lastName} onChange={(e) => updateChild(i, "lastName", e.target.value)} className={inputWhiteCls} autoComplete="on" />
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

                  {/* Start Date & Hours */}
                  <div>
                    <label className="mb-1 block text-sm font-medium text-forest-800">Desired Start Date (2026)</label>
                    <select value={child.desiredStartDate} onChange={(e) => updateChild(i, "desiredStartDate", e.target.value)} className={inputWhiteCls}>
                      <option value="">Select...</option>
                      <option value="august">August</option>
                      <option value="september">September</option>
                      <option value="october">October</option>
                      <option value="november">November</option>
                      <option value="december">December</option>
                      <option value="2027">2027</option>
                      <option value="unsure">Not sure yet</option>
                    </select>
                  </div>
                  <div>
                    <label className="mb-1 block text-sm font-medium text-forest-800">Hours Needed</label>
                    <select value={child.hoursNeeded} onChange={(e) => updateChild(i, "hoursNeeded", e.target.value)} className={inputWhiteCls}>
                      <option value="">Select...</option>
                      <option value="half-day-am">Half Day (AM)</option>
                      <option value="half-day-pm">Half Day (PM)</option>
                      <option value="full-day">Full Day</option>
                      <option value="flexible">Flexible</option>
                    </select>
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
                      autoComplete="on"
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

            {coParents.length > 0 && (
              <div className="mb-4">
                <div className="mb-1 flex items-center justify-between">
                  <h3 className="text-sm font-semibold uppercase tracking-wider text-forest-500">Co-Parents ({coParents.length})</h3>
                  <button type="button" onClick={() => setStep(1)} className="text-xs font-medium text-forest-600 active:text-forest-800">Edit</button>
                </div>
                {coParents.map((cp, i) => (
                  <div key={i} className="mb-2 rounded-lg bg-paper-50 p-3 text-sm">
                    <p className="font-medium">{cp.fullName || "Unnamed"}</p>
                    {cp.email && <p>Email: {cp.email}</p>}
                    {cp.phone && <p>Phone: {cp.phone}</p>}
                    {cp.relationship && <p>Relationship: {cp.relationship}</p>}
                  </div>
                ))}
              </div>
            )}

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
                  {child.desiredStartDate && <p>Start: {child.desiredStartDate.charAt(0).toUpperCase() + child.desiredStartDate.slice(1)}</p>}
                  {child.hoursNeeded && <p>Hours: {child.hoursNeeded.replace(/-/g, " ").replace(/\b\w/g, (c) => c.toUpperCase())}</p>}
                  {child.staffNotes && <p>Staff Notes: {child.staffNotes}</p>}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Error near button */}
        {error && (
          <div className="mt-4 rounded-lg bg-red-50 p-3 text-sm text-red-700">{error}</div>
        )}

        {/* Navigation buttons */}
        <div className="mt-4 flex justify-between gap-3">
          {step > 1 ? (
            <button
              type="button"
              onClick={() => { setError(""); setStep((s) => s - 1); }}
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
