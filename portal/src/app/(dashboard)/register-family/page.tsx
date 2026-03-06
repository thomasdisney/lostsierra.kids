"use client";

import { useSession } from "next-auth/react";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

interface ChildForm {
  firstName: string;
  lastName: string;
  dateOfBirth: string;
  gender: string;
  allergies: string;
  medicalNotes: string;
  programId: string;
}

interface Program {
  id: string;
  name: string;
  description: string;
  ageRange: string;
}

const emptyChild: ChildForm = {
  firstName: "",
  lastName: "",
  dateOfBirth: "",
  gender: "",
  allergies: "",
  medicalNotes: "",
  programId: "",
};

export default function RegisterFamilyPage() {
  const { data: session } = useSession();
  const router = useRouter();
  const [step, setStep] = useState(1);
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [programs, setPrograms] = useState<Program[]>([]);

  // Step 1: Contact Info
  const [guardian, setGuardian] = useState({
    fullName: "",
    email: "",
    phone: "",
    altPhone: "",
    relationship: "mother" as string,
    occupation: "",
  });

  // Step 2: Address
  const [address, setAddress] = useState({
    addressLine1: "",
    addressLine2: "",
    city: "",
    state: "CA",
    zip: "",
    country: "US",
  });

  // Step 3: Children
  const [children, setChildren] = useState<ChildForm[]>([{ ...emptyChild }]);

  useEffect(() => {
    if (session?.user) {
      setGuardian((g) => ({
        ...g,
        fullName: session.user.name || "",
        email: session.user.email || "",
      }));
    }
    fetch("/portal/api/admin/programs")
      .then((r) => r.json())
      .then((data) => setPrograms(data.programs || []));
  }, [session]);

  function updateChild(index: number, field: string, value: string) {
    setChildren((prev) =>
      prev.map((c, i) => (i === index ? { ...c, [field]: value } : c))
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
        if (!child.firstName || !child.lastName || !child.dateOfBirth || !child.programId) {
          setError("Please fill in all required fields for each child");
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

    window.location.href = "/portal/dashboard";
  }

  const stepTitles = ["Contact Info", "Address", "Children", "Review"];

  return (
    <div>
      <h1 className="mb-1 text-2xl font-bold text-forest-900">
        Family Pre-Registration
      </h1>
      <p className="mb-8 text-forest-600">
        Register your family for Lost Sierra Kids programs
      </p>

      {/* Step indicators */}
      <div className="mb-8 flex items-center gap-2">
        {stepTitles.map((title, i) => (
          <div key={title} className="flex items-center gap-2">
            <div
              className={`flex h-8 w-8 items-center justify-center rounded-full text-sm font-medium ${
                i + 1 <= step
                  ? "bg-forest-800 text-white"
                  : "bg-paper-200 text-forest-500"
              }`}
            >
              {i + 1}
            </div>
            <span
              className={`hidden text-sm md:inline ${
                i + 1 === step
                  ? "font-medium text-forest-800"
                  : "text-forest-500"
              }`}
            >
              {title}
            </span>
            {i < 3 && (
              <div className="h-px w-4 bg-paper-300 md:w-8" />
            )}
          </div>
        ))}
      </div>

      {error && (
        <div className="mb-4 rounded-lg bg-red-50 p-3 text-sm text-red-700">
          {error}
        </div>
      )}

      <div className="rounded-xl border border-paper-200 bg-white p-6 md:p-8">
        {/* Step 1: Contact Info */}
        {step === 1 && (
          <div>
            <h2 className="mb-6 text-lg font-semibold text-forest-900">
              Contact Information
            </h2>
            <div className="grid gap-4 md:grid-cols-2">
              <div>
                <label className="mb-1 block text-sm font-medium text-forest-800">
                  Full Name *
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
                  Email *
                </label>
                <input
                  type="email"
                  value={guardian.email}
                  onChange={(e) =>
                    setGuardian({ ...guardian, email: e.target.value })
                  }
                  className="w-full rounded-lg border border-paper-300 bg-paper-50 px-4 py-2.5 text-forest-900 outline-none focus:border-forest-500 focus:ring-2 focus:ring-forest-200"
                />
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium text-forest-800">
                  Phone *
                </label>
                <input
                  type="tel"
                  value={guardian.phone}
                  onChange={(e) =>
                    setGuardian({ ...guardian, phone: e.target.value })
                  }
                  className="w-full rounded-lg border border-paper-300 bg-paper-50 px-4 py-2.5 text-forest-900 outline-none focus:border-forest-500 focus:ring-2 focus:ring-forest-200"
                />
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium text-forest-800">
                  Alternate Phone
                </label>
                <input
                  type="tel"
                  value={guardian.altPhone}
                  onChange={(e) =>
                    setGuardian({ ...guardian, altPhone: e.target.value })
                  }
                  className="w-full rounded-lg border border-paper-300 bg-paper-50 px-4 py-2.5 text-forest-900 outline-none focus:border-forest-500 focus:ring-2 focus:ring-forest-200"
                />
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium text-forest-800">
                  Relationship to Children *
                </label>
                <select
                  value={guardian.relationship}
                  onChange={(e) =>
                    setGuardian({ ...guardian, relationship: e.target.value })
                  }
                  className="w-full rounded-lg border border-paper-300 bg-paper-50 px-4 py-2.5 text-forest-900 outline-none focus:border-forest-500 focus:ring-2 focus:ring-forest-200"
                >
                  <option value="mother">Mother</option>
                  <option value="father">Father</option>
                  <option value="guardian">Guardian</option>
                  <option value="grandparent">Grandparent</option>
                  <option value="other">Other</option>
                </select>
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium text-forest-800">
                  Occupation
                </label>
                <input
                  type="text"
                  value={guardian.occupation}
                  onChange={(e) =>
                    setGuardian({ ...guardian, occupation: e.target.value })
                  }
                  className="w-full rounded-lg border border-paper-300 bg-paper-50 px-4 py-2.5 text-forest-900 outline-none focus:border-forest-500 focus:ring-2 focus:ring-forest-200"
                />
              </div>
            </div>
          </div>
        )}

        {/* Step 2: Address */}
        {step === 2 && (
          <div>
            <h2 className="mb-6 text-lg font-semibold text-forest-900">
              Home Address
            </h2>
            <div className="grid gap-4">
              <div>
                <label className="mb-1 block text-sm font-medium text-forest-800">
                  Address Line 1 *
                </label>
                <input
                  type="text"
                  value={address.addressLine1}
                  onChange={(e) =>
                    setAddress({ ...address, addressLine1: e.target.value })
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
                  value={address.addressLine2}
                  onChange={(e) =>
                    setAddress({ ...address, addressLine2: e.target.value })
                  }
                  className="w-full rounded-lg border border-paper-300 bg-paper-50 px-4 py-2.5 text-forest-900 outline-none focus:border-forest-500 focus:ring-2 focus:ring-forest-200"
                />
              </div>
              <div className="grid gap-4 md:grid-cols-3">
                <div>
                  <label className="mb-1 block text-sm font-medium text-forest-800">
                    City *
                  </label>
                  <input
                    type="text"
                    value={address.city}
                    onChange={(e) =>
                      setAddress({ ...address, city: e.target.value })
                    }
                    className="w-full rounded-lg border border-paper-300 bg-paper-50 px-4 py-2.5 text-forest-900 outline-none focus:border-forest-500 focus:ring-2 focus:ring-forest-200"
                  />
                </div>
                <div>
                  <label className="mb-1 block text-sm font-medium text-forest-800">
                    State *
                  </label>
                  <input
                    type="text"
                    value={address.state}
                    onChange={(e) =>
                      setAddress({ ...address, state: e.target.value })
                    }
                    className="w-full rounded-lg border border-paper-300 bg-paper-50 px-4 py-2.5 text-forest-900 outline-none focus:border-forest-500 focus:ring-2 focus:ring-forest-200"
                  />
                </div>
                <div>
                  <label className="mb-1 block text-sm font-medium text-forest-800">
                    ZIP Code *
                  </label>
                  <input
                    type="text"
                    value={address.zip}
                    onChange={(e) =>
                      setAddress({ ...address, zip: e.target.value })
                    }
                    className="w-full rounded-lg border border-paper-300 bg-paper-50 px-4 py-2.5 text-forest-900 outline-none focus:border-forest-500 focus:ring-2 focus:ring-forest-200"
                  />
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Step 3: Children */}
        {step === 3 && (
          <div>
            <h2 className="mb-6 text-lg font-semibold text-forest-900">
              Children
            </h2>
            {children.map((child, i) => (
              <div
                key={i}
                className="mb-6 rounded-lg border border-paper-200 bg-paper-50 p-4"
              >
                <div className="mb-4 flex items-center justify-between">
                  <h3 className="font-medium text-forest-800">
                    Child {i + 1}
                  </h3>
                  {children.length > 1 && (
                    <button
                      type="button"
                      onClick={() => removeChild(i)}
                      className="text-sm text-red-600 hover:text-red-800"
                    >
                      Remove
                    </button>
                  )}
                </div>
                <div className="grid gap-4 md:grid-cols-2">
                  <div>
                    <label className="mb-1 block text-sm font-medium text-forest-800">
                      First Name *
                    </label>
                    <input
                      type="text"
                      value={child.firstName}
                      onChange={(e) =>
                        updateChild(i, "firstName", e.target.value)
                      }
                      className="w-full rounded-lg border border-paper-300 bg-white px-4 py-2.5 text-forest-900 outline-none focus:border-forest-500 focus:ring-2 focus:ring-forest-200"
                    />
                  </div>
                  <div>
                    <label className="mb-1 block text-sm font-medium text-forest-800">
                      Last Name *
                    </label>
                    <input
                      type="text"
                      value={child.lastName}
                      onChange={(e) =>
                        updateChild(i, "lastName", e.target.value)
                      }
                      className="w-full rounded-lg border border-paper-300 bg-white px-4 py-2.5 text-forest-900 outline-none focus:border-forest-500 focus:ring-2 focus:ring-forest-200"
                    />
                  </div>
                  <div>
                    <label className="mb-1 block text-sm font-medium text-forest-800">
                      Date of Birth *
                    </label>
                    <input
                      type="date"
                      value={child.dateOfBirth}
                      onChange={(e) =>
                        updateChild(i, "dateOfBirth", e.target.value)
                      }
                      className="w-full rounded-lg border border-paper-300 bg-white px-4 py-2.5 text-forest-900 outline-none focus:border-forest-500 focus:ring-2 focus:ring-forest-200"
                    />
                  </div>
                  <div>
                    <label className="mb-1 block text-sm font-medium text-forest-800">
                      Gender
                    </label>
                    <select
                      value={child.gender}
                      onChange={(e) =>
                        updateChild(i, "gender", e.target.value)
                      }
                      className="w-full rounded-lg border border-paper-300 bg-white px-4 py-2.5 text-forest-900 outline-none focus:border-forest-500 focus:ring-2 focus:ring-forest-200"
                    >
                      <option value="">Select...</option>
                      <option value="male">Male</option>
                      <option value="female">Female</option>
                      <option value="other">Other</option>
                    </select>
                  </div>
                  <div>
                    <label className="mb-1 block text-sm font-medium text-forest-800">
                      Desired Program *
                    </label>
                    <select
                      value={child.programId}
                      onChange={(e) =>
                        updateChild(i, "programId", e.target.value)
                      }
                      className="w-full rounded-lg border border-paper-300 bg-white px-4 py-2.5 text-forest-900 outline-none focus:border-forest-500 focus:ring-2 focus:ring-forest-200"
                    >
                      <option value="">Select a program...</option>
                      {programs.map((p) => (
                        <option key={p.id} value={p.id}>
                          {p.name} (ages {p.ageRange})
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="mb-1 block text-sm font-medium text-forest-800">
                      Allergies
                    </label>
                    <input
                      type="text"
                      value={child.allergies}
                      onChange={(e) =>
                        updateChild(i, "allergies", e.target.value)
                      }
                      className="w-full rounded-lg border border-paper-300 bg-white px-4 py-2.5 text-forest-900 outline-none focus:border-forest-500 focus:ring-2 focus:ring-forest-200"
                    />
                  </div>
                  <div className="md:col-span-2">
                    <label className="mb-1 block text-sm font-medium text-forest-800">
                      Medical Notes
                    </label>
                    <textarea
                      value={child.medicalNotes}
                      onChange={(e) =>
                        updateChild(i, "medicalNotes", e.target.value)
                      }
                      rows={2}
                      className="w-full rounded-lg border border-paper-300 bg-white px-4 py-2.5 text-forest-900 outline-none focus:border-forest-500 focus:ring-2 focus:ring-forest-200"
                    />
                  </div>
                </div>
              </div>
            ))}
            <button
              type="button"
              onClick={addChild}
              className="rounded-lg border border-dashed border-forest-400 px-4 py-2 text-sm font-medium text-forest-600 transition hover:bg-forest-50"
            >
              + Add Another Child
            </button>
          </div>
        )}

        {/* Step 4: Review */}
        {step === 4 && (
          <div>
            <h2 className="mb-6 text-lg font-semibold text-forest-900">
              Review Your Information
            </h2>

            <div className="mb-6">
              <h3 className="mb-2 text-sm font-semibold uppercase tracking-wider text-forest-500">
                Contact
              </h3>
              <div className="rounded-lg bg-paper-50 p-4 text-sm">
                <p>
                  <span className="font-medium">Name:</span>{" "}
                  {guardian.fullName}
                </p>
                <p>
                  <span className="font-medium">Email:</span> {guardian.email}
                </p>
                <p>
                  <span className="font-medium">Phone:</span> {guardian.phone}
                </p>
                <p>
                  <span className="font-medium">Relationship:</span>{" "}
                  {guardian.relationship}
                </p>
                {guardian.occupation && (
                  <p>
                    <span className="font-medium">Occupation:</span>{" "}
                    {guardian.occupation}
                  </p>
                )}
              </div>
            </div>

            <div className="mb-6">
              <h3 className="mb-2 text-sm font-semibold uppercase tracking-wider text-forest-500">
                Address
              </h3>
              <div className="rounded-lg bg-paper-50 p-4 text-sm">
                <p>{address.addressLine1}</p>
                {address.addressLine2 && <p>{address.addressLine2}</p>}
                <p>
                  {address.city}, {address.state} {address.zip}
                </p>
              </div>
            </div>

            <div>
              <h3 className="mb-2 text-sm font-semibold uppercase tracking-wider text-forest-500">
                Children ({children.length})
              </h3>
              {children.map((child, i) => {
                const program = programs.find(
                  (p) => p.id === child.programId
                );
                return (
                  <div
                    key={i}
                    className="mb-2 rounded-lg bg-paper-50 p-4 text-sm"
                  >
                    <p className="font-medium">
                      {child.firstName} {child.lastName}
                    </p>
                    <p>DOB: {child.dateOfBirth}</p>
                    <p>Program: {program?.name || "N/A"}</p>
                    {child.allergies && <p>Allergies: {child.allergies}</p>}
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Navigation buttons */}
        <div className="mt-8 flex justify-between">
          {step > 1 ? (
            <button
              type="button"
              onClick={() => setStep((s) => s - 1)}
              className="rounded-lg border border-paper-300 px-6 py-2.5 text-sm font-medium text-forest-600 transition hover:bg-paper-100"
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
              className="rounded-lg bg-forest-800 px-6 py-2.5 text-sm font-medium text-white transition hover:bg-forest-700"
            >
              Continue
            </button>
          ) : (
            <button
              type="button"
              onClick={handleSubmit}
              disabled={submitting}
              className="rounded-lg bg-forest-800 px-6 py-2.5 text-sm font-medium text-white transition hover:bg-forest-700 disabled:opacity-50"
            >
              {submitting ? "Submitting..." : "Submit Registration"}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
