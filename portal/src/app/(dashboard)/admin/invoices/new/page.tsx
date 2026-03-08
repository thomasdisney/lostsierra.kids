"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

interface Guardian {
  id: string;
  fullName: string;
  email: string;
}

interface LineItem {
  description: string;
  quantity: number;
  unitPrice: number; // dollars for display, converted to cents on submit
}

export default function NewInvoicePage() {
  const router = useRouter();
  const [guardians, setGuardians] = useState<Guardian[]>([]);
  const [guardianId, setGuardianId] = useState("");
  const [dueDate, setDueDate] = useState("");
  const [notes, setNotes] = useState("");
  const [items, setItems] = useState<LineItem[]>([
    { description: "", quantity: 1, unitPrice: 0 },
  ]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    loadGuardians();
  }, []);

  async function loadGuardians() {
    const res = await fetch("/portal/api/admin/families");
    const data = await res.json();
    setGuardians(data.guardians || []);
  }

  function updateItem(index: number, field: keyof LineItem, value: string | number) {
    setItems((prev) =>
      prev.map((item, i) =>
        i === index ? { ...item, [field]: value } : item
      )
    );
  }

  function addItem() {
    setItems((prev) => [...prev, { description: "", quantity: 1, unitPrice: 0 }]);
  }

  function removeItem(index: number) {
    if (items.length > 1) {
      setItems((prev) => prev.filter((_, i) => i !== index));
    }
  }

  const subtotal = items.reduce(
    (sum, item) => sum + item.quantity * item.unitPrice,
    0
  );

  async function handleSubmit() {
    setError("");
    if (!guardianId) {
      setError("Select a family");
      return;
    }
    if (items.some((i) => !i.description || i.unitPrice <= 0)) {
      setError("All items need a description and price");
      return;
    }

    setSaving(true);
    const res = await fetch("/portal/api/admin/invoices", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        guardianId,
        items: items.map((i) => ({
          description: i.description,
          quantity: i.quantity,
          unitPrice: Math.round(i.unitPrice * 100),
        })),
        dueDate: dueDate || undefined,
        notes: notes || undefined,
        tax: 0,
      }),
    });

    if (res.ok) {
      router.push("/admin/invoices");
    } else {
      const data = await res.json();
      setError(data.error || "Failed to create invoice");
    }
    setSaving(false);
  }

  return (
    <div>
      <h1 className="mb-1 text-2xl font-bold text-forest-900">
        New Invoice
      </h1>
      <p className="mb-8 text-forest-600">Create an invoice for a family</p>

      {error && (
        <div className="mb-4 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">
          {error}
        </div>
      )}

      <div className="rounded-xl border border-paper-200 bg-white p-6">
        <div className="mb-4 flex gap-4">
          <div className="flex-1">
            <label className="mb-1 block text-sm font-medium text-forest-700">
              Family
            </label>
            <select
              value={guardianId}
              onChange={(e) => setGuardianId(e.target.value)}
              className="w-full rounded-lg border border-paper-200 px-3 py-2 text-sm focus:border-forest-500 focus:outline-none"
            >
              <option value="">Select family...</option>
              {guardians.map((g) => (
                <option key={g.id} value={g.id}>
                  {g.fullName} ({g.email})
                </option>
              ))}
            </select>
          </div>
          <div className="min-w-[180px]">
            <label className="mb-1 block text-sm font-medium text-forest-700">
              Due Date
            </label>
            <input
              type="date"
              value={dueDate}
              onChange={(e) => setDueDate(e.target.value)}
              className="w-full rounded-lg border border-paper-200 px-3 py-2 text-sm focus:border-forest-500 focus:outline-none"
            />
          </div>
        </div>

        <div className="mb-4">
          <label className="mb-2 block text-sm font-medium text-forest-700">
            Line Items
          </label>
          {items.map((item, i) => (
            <div key={i} className="mb-2 flex gap-2">
              <input
                value={item.description}
                onChange={(e) => updateItem(i, "description", e.target.value)}
                placeholder="Description"
                className="flex-1 rounded-lg border border-paper-200 px-3 py-2 text-sm focus:border-forest-500 focus:outline-none"
              />
              <input
                type="number"
                value={item.quantity}
                onChange={(e) =>
                  updateItem(i, "quantity", parseInt(e.target.value) || 1)
                }
                min={1}
                className="w-20 rounded-lg border border-paper-200 px-3 py-2 text-sm focus:border-forest-500 focus:outline-none"
                placeholder="Qty"
              />
              <div className="relative">
                <span className="absolute left-3 top-2 text-sm text-forest-400">
                  $
                </span>
                <input
                  type="number"
                  step="0.01"
                  value={item.unitPrice || ""}
                  onChange={(e) =>
                    updateItem(
                      i,
                      "unitPrice",
                      parseFloat(e.target.value) || 0
                    )
                  }
                  className="w-28 rounded-lg border border-paper-200 py-2 pl-7 pr-3 text-sm focus:border-forest-500 focus:outline-none"
                  placeholder="0.00"
                />
              </div>
              {items.length > 1 && (
                <button
                  onClick={() => removeItem(i)}
                  className="px-2 text-red-400 hover:text-red-600"
                >
                  &times;
                </button>
              )}
            </div>
          ))}
          <button
            onClick={addItem}
            className="mt-1 text-xs font-medium text-forest-600 hover:text-forest-800"
          >
            + Add item
          </button>
        </div>

        <div className="mb-4">
          <label className="mb-1 block text-sm font-medium text-forest-700">
            Notes
          </label>
          <textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            rows={2}
            className="w-full rounded-lg border border-paper-200 px-3 py-2 text-sm focus:border-forest-500 focus:outline-none"
            placeholder="Optional notes..."
          />
        </div>

        <div className="mb-6 border-t border-paper-100 pt-4">
          <div className="text-right text-lg font-bold text-forest-900">
            Total: ${subtotal.toFixed(2)}
          </div>
        </div>

        <div className="flex gap-3">
          <button
            onClick={handleSubmit}
            disabled={saving}
            className="rounded-lg bg-forest-700 px-6 py-2 text-sm font-medium text-white transition hover:bg-forest-600 disabled:opacity-50"
          >
            {saving ? "Creating..." : "Create Invoice"}
          </button>
          <button
            onClick={() => router.push("/admin/invoices")}
            className="px-4 py-2 text-sm text-forest-500 hover:text-forest-700"
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
}
