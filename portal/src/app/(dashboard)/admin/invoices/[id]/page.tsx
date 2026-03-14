"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";

interface InvoiceDetail {
  id: string;
  invoiceNumber: string;
  status: string;
  subtotal: number;
  tax: number;
  total: number;
  dueDate: string | null;
  notes: string | null;
  paidAt: string | null;
  createdAt: string;
  items: {
    id: string;
    description: string;
    quantity: number;
    unitPrice: number;
    total: number;
  }[];
  payments: {
    id: string;
    amount: number;
    method: string;
    notes: string | null;
    paidAt: string;
  }[];
  totalPaid: number;
}

function formatMoney(cents: number): string {
  return `$${(cents / 100).toFixed(2)}`;
}

const statusColors: Record<string, string> = {
  draft: "bg-gray-100 text-gray-700",
  sent: "bg-blue-100 text-blue-700",
  paid: "bg-green-100 text-green-700",
  overdue: "bg-red-100 text-red-700",
  cancelled: "bg-paper-200 text-forest-500",
};

export default function AdminInvoiceDetailPage() {
  const params = useParams();
  const router = useRouter();
  const [invoice, setInvoice] = useState<InvoiceDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [showPayment, setShowPayment] = useState(false);
  const [payAmount, setPayAmount] = useState("");
  const [payMethod, setPayMethod] = useState("cash");
  const [payNotes, setPayNotes] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    load();
  }, []);

  async function load() {
    const res = await fetch(`/portal/api/invoices/${params.id}`);
    const data = await res.json();
    setInvoice(data.invoice || null);
    setLoading(false);
  }

  async function recordPayment() {
    setSaving(true);
    await fetch("/portal/api/admin/payments", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        invoiceId: params.id,
        amount: Math.round(parseFloat(payAmount) * 100),
        method: payMethod,
        notes: payNotes || undefined,
      }),
    });
    setShowPayment(false);
    setPayAmount("");
    setPayNotes("");
    setSaving(false);
    load();
  }

  async function sendInvoice() {
    await fetch(`/portal/api/admin/invoices/${params.id}/send`, {
      method: "POST",
    });
    load();
  }

  async function updateStatus(status: string) {
    await fetch("/portal/api/admin/invoices", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: params.id, status }),
    });
    load();
  }

  if (loading || !invoice) {
    return (
      <div>
        <div className="mb-2 h-7 w-44 animate-pulse rounded-lg bg-paper-200" />
        <div className="mb-8 h-4 w-56 animate-pulse rounded-lg bg-paper-200" />
        <div className="space-y-3">
          {[1, 2].map((i) => (
            <div key={i} className="h-20 animate-pulse rounded-xl bg-paper-100" />
          ))}
        </div>
      </div>
    );
  }

  const balance = invoice.total - invoice.totalPaid;

  return (
    <div>
      <button
        onClick={() => router.push("/portal/admin/invoices")}
        className="mb-4 text-sm text-forest-500 hover:text-forest-700"
      >
        &larr; All Invoices
      </button>

      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-forest-900">
            {invoice.invoiceNumber}
          </h1>
          <span
            className={`inline-block rounded-full px-2.5 py-0.5 text-xs font-medium ${
              statusColors[invoice.status] || ""
            }`}
          >
            {invoice.status}
          </span>
        </div>
        <div className="flex gap-2">
          {invoice.status === "draft" && (
            <button
              onClick={sendInvoice}
              className="rounded-lg bg-forest-700 px-4 py-2 text-sm font-medium text-white transition hover:bg-forest-600"
            >
              Send
            </button>
          )}
          {(invoice.status === "sent" || invoice.status === "overdue") && (
            <button
              onClick={() => setShowPayment(true)}
              className="rounded-lg bg-forest-700 px-4 py-2 text-sm font-medium text-white transition hover:bg-forest-600"
            >
              Record Payment
            </button>
          )}
          {invoice.status !== "cancelled" && invoice.status !== "paid" && (
            <button
              onClick={() => updateStatus("cancelled")}
              className="rounded-lg border border-paper-300 px-4 py-2 text-sm text-forest-500 transition hover:bg-paper-100"
            >
              Cancel
            </button>
          )}
        </div>
      </div>

      {/* Line items */}
      <div className="mb-6 rounded-xl border border-paper-200 bg-white">
        <div className="border-b border-paper-200 p-4">
          <h2 className="font-semibold text-forest-900">Line Items</h2>
        </div>
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-paper-100 text-left">
              <th className="px-4 py-2 font-medium text-forest-600">
                Description
              </th>
              <th className="px-4 py-2 text-right font-medium text-forest-600">
                Qty
              </th>
              <th className="px-4 py-2 text-right font-medium text-forest-600">
                Price
              </th>
              <th className="px-4 py-2 text-right font-medium text-forest-600">
                Total
              </th>
            </tr>
          </thead>
          <tbody>
            {invoice.items.map((item) => (
              <tr
                key={item.id}
                className="border-b border-paper-100 last:border-0"
              >
                <td className="px-4 py-3 text-forest-800">
                  {item.description}
                </td>
                <td className="px-4 py-3 text-right text-forest-600">
                  {item.quantity}
                </td>
                <td className="px-4 py-3 text-right text-forest-600">
                  {formatMoney(item.unitPrice)}
                </td>
                <td className="px-4 py-3 text-right font-medium text-forest-900">
                  {formatMoney(item.total)}
                </td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr className="border-t border-paper-200">
              <td colSpan={3} className="px-4 py-3 text-right font-medium text-forest-700">
                Total
              </td>
              <td className="px-4 py-3 text-right text-lg font-bold text-forest-900">
                {formatMoney(invoice.total)}
              </td>
            </tr>
            {invoice.totalPaid > 0 && (
              <>
                <tr>
                  <td colSpan={3} className="px-4 py-1 text-right text-sm text-green-600">
                    Paid
                  </td>
                  <td className="px-4 py-1 text-right text-sm text-green-600">
                    -{formatMoney(invoice.totalPaid)}
                  </td>
                </tr>
                <tr>
                  <td colSpan={3} className="px-4 py-1 text-right font-medium text-forest-700">
                    Balance
                  </td>
                  <td className="px-4 py-1 text-right font-bold text-forest-900">
                    {formatMoney(balance)}
                  </td>
                </tr>
              </>
            )}
          </tfoot>
        </table>
      </div>

      {/* Payment form */}
      {showPayment && (
        <div className="mb-6 rounded-xl border border-paper-200 bg-white p-6">
          <h2 className="mb-4 font-semibold text-forest-900">Record Payment</h2>
          <div className="mb-4 flex gap-4">
            <div className="flex-1">
              <label className="mb-1 block text-sm font-medium text-forest-700">
                Amount ($)
              </label>
              <input
                type="number"
                step="0.01"
                value={payAmount}
                onChange={(e) => setPayAmount(e.target.value)}
                placeholder={`${(balance / 100).toFixed(2)}`}
                className="w-full rounded-lg border border-paper-200 px-3 py-2 text-sm focus:border-forest-500 focus:outline-none"
              />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-forest-700">
                Method
              </label>
              <select
                value={payMethod}
                onChange={(e) => setPayMethod(e.target.value)}
                className="rounded-lg border border-paper-200 px-3 py-2 text-sm focus:border-forest-500 focus:outline-none"
              >
                <option value="cash">Cash</option>
                <option value="check">Check</option>
                <option value="other">Other</option>
              </select>
            </div>
          </div>
          <div className="mb-4">
            <label className="mb-1 block text-sm font-medium text-forest-700">
              Notes
            </label>
            <input
              value={payNotes}
              onChange={(e) => setPayNotes(e.target.value)}
              className="w-full rounded-lg border border-paper-200 px-3 py-2 text-sm focus:border-forest-500 focus:outline-none"
              placeholder="Optional notes..."
            />
          </div>
          <div className="flex gap-3">
            <button
              onClick={recordPayment}
              disabled={saving || !payAmount || parseFloat(payAmount) <= 0}
              className="rounded-lg bg-forest-700 px-4 py-2 text-sm font-medium text-white transition hover:bg-forest-600 disabled:opacity-50"
            >
              {saving ? "Saving..." : "Record Payment"}
            </button>
            <button
              onClick={() => setShowPayment(false)}
              className="px-4 py-2 text-sm text-forest-500"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* Payment history */}
      {invoice.payments.length > 0 && (
        <div className="rounded-xl border border-paper-200 bg-white">
          <div className="border-b border-paper-200 p-4">
            <h2 className="font-semibold text-forest-900">Payment History</h2>
          </div>
          {invoice.payments.map((p) => (
            <div
              key={p.id}
              className="flex items-center justify-between border-b border-paper-100 p-4 last:border-0"
            >
              <div>
                <div className="text-sm font-medium text-forest-800">
                  {formatMoney(p.amount)} via {p.method}
                </div>
                {p.notes && (
                  <div className="text-xs text-forest-500">{p.notes}</div>
                )}
              </div>
              <div className="text-xs text-forest-500">
                {new Date(p.paidAt).toLocaleDateString()}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
