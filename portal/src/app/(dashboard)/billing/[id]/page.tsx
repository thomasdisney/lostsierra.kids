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
    paidAt: string;
  }[];
  totalPaid: number;
}

function formatMoney(cents: number): string {
  return `$${(cents / 100).toFixed(2)}`;
}

const statusColors: Record<string, string> = {
  sent: "bg-blue-100 text-blue-700",
  paid: "bg-green-100 text-green-700",
  overdue: "bg-red-100 text-red-700",
  cancelled: "bg-paper-200 text-forest-500",
};

export default function InvoiceDetailPage() {
  const params = useParams();
  const router = useRouter();
  const [invoice, setInvoice] = useState<InvoiceDetail | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    load();
  }, []);

  async function load() {
    const res = await fetch(`/portal/api/invoices/${params.id}`);
    const data = await res.json();
    setInvoice(data.invoice || null);
    setLoading(false);
  }

  if (loading || !invoice) {
    return (
      <div className="flex h-64 items-center justify-center">
        <div className="text-forest-500">Loading...</div>
      </div>
    );
  }

  const balance = invoice.total - invoice.totalPaid;

  return (
    <div>
      <button
        onClick={() => router.push("/billing")}
        className="mb-4 text-sm text-forest-500 hover:text-forest-700"
      >
        &larr; All Invoices
      </button>

      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-forest-900">
            {invoice.invoiceNumber}
          </h1>
          <div className="flex items-center gap-2">
            <span
              className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${
                statusColors[invoice.status] || ""
              }`}
            >
              {invoice.status}
            </span>
            {invoice.dueDate && (
              <span className="text-xs text-forest-500">
                Due{" "}
                {new Date(invoice.dueDate + "T00:00:00").toLocaleDateString()}
              </span>
            )}
          </div>
        </div>
        <div className="text-right">
          <div className="text-2xl font-bold text-forest-900">
            {formatMoney(invoice.total)}
          </div>
          {invoice.status === "paid" && (
            <div className="text-sm text-green-600">Paid in full</div>
          )}
          {balance > 0 && invoice.status !== "cancelled" && (
            <div className="text-sm text-forest-600">
              Balance: {formatMoney(balance)}
            </div>
          )}
        </div>
      </div>

      {/* Line items */}
      <div className="mb-6 rounded-xl border border-paper-200 bg-white">
        {invoice.items.map((item, i) => (
          <div
            key={item.id}
            className={`flex items-center justify-between p-4 ${
              i < invoice.items.length - 1
                ? "border-b border-paper-100"
                : ""
            }`}
          >
            <div>
              <div className="text-sm font-medium text-forest-800">
                {item.description}
              </div>
              {item.quantity > 1 && (
                <div className="text-xs text-forest-500">
                  {item.quantity} x {formatMoney(item.unitPrice)}
                </div>
              )}
            </div>
            <div className="font-medium text-forest-900">
              {formatMoney(item.total)}
            </div>
          </div>
        ))}
      </div>

      {/* Payment history */}
      {invoice.payments.length > 0 && (
        <div className="rounded-xl border border-paper-200 bg-white">
          <div className="border-b border-paper-200 p-4">
            <h2 className="text-sm font-semibold text-forest-900">
              Payment History
            </h2>
          </div>
          {invoice.payments.map((p) => (
            <div
              key={p.id}
              className="flex items-center justify-between border-b border-paper-100 p-4 last:border-0"
            >
              <div className="text-sm text-forest-800">
                {formatMoney(p.amount)} via {p.method}
              </div>
              <div className="text-xs text-forest-500">
                {new Date(p.paidAt).toLocaleDateString()}
              </div>
            </div>
          ))}
        </div>
      )}

      {invoice.notes && (
        <div className="mt-6 rounded-xl border border-paper-200 bg-white p-4">
          <h2 className="mb-1 text-sm font-semibold text-forest-900">Notes</h2>
          <p className="text-sm text-forest-600">{invoice.notes}</p>
        </div>
      )}
    </div>
  );
}
