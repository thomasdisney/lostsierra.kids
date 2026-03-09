"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

interface Invoice {
  id: string;
  invoiceNumber: string;
  status: string;
  total: number;
  totalPaid: number;
  dueDate: string | null;
  createdAt: string;
}

const statusColors: Record<string, string> = {
  draft: "bg-gray-100 text-gray-700",
  sent: "bg-blue-100 text-blue-700",
  paid: "bg-green-100 text-green-700",
  overdue: "bg-red-100 text-red-700",
  cancelled: "bg-paper-200 text-forest-500",
};

function formatMoney(cents: number): string {
  return `$${(cents / 100).toFixed(2)}`;
}

export default function BillingPage() {
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    load();
  }, []);

  async function load() {
    const res = await fetch("/portal/api/invoices");
    const data = await res.json();
    setInvoices(data.invoices || []);
    setLoading(false);
  }

  if (loading) {
    return (
      <div className="flex h-64 items-center justify-center">
        <div className="text-forest-500">Loading...</div>
      </div>
    );
  }

  const unpaid = invoices.filter(
    (i) => i.status === "sent" || i.status === "overdue"
  );
  const totalOwed = unpaid.reduce(
    (sum, i) => sum + (i.total - i.totalPaid),
    0
  );

  return (
    <div>
      <h1 className="mb-1 text-2xl font-bold text-forest-900">Billing</h1>
      <p className="mb-8 text-forest-600">
        {totalOwed > 0
          ? `Balance due: ${formatMoney(totalOwed)}`
          : "All paid up"}
      </p>

      {invoices.length === 0 ? (
        <div className="rounded-xl border border-paper-200 bg-white p-8 text-center text-forest-500">
          No invoices yet
        </div>
      ) : (
        <div className="space-y-3">
          {invoices
            .filter((i) => i.status !== "draft")
            .map((inv) => (
              <Link
                key={inv.id}
                href={`/portal/billing/${inv.id}`}
                className="block rounded-xl border border-paper-200 bg-white p-4 transition hover:shadow-sm"
              >
                <div className="flex items-center justify-between">
                  <div>
                    <div className="font-medium text-forest-900">
                      {inv.invoiceNumber}
                    </div>
                    <div className="text-xs text-forest-500">
                      {inv.dueDate
                        ? `Due ${new Date(inv.dueDate + "T00:00:00").toLocaleDateString()}`
                        : new Date(inv.createdAt).toLocaleDateString()}
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="text-lg font-bold text-forest-900">
                      {formatMoney(inv.total)}
                    </span>
                    <span
                      className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${
                        statusColors[inv.status] || ""
                      }`}
                    >
                      {inv.status}
                    </span>
                  </div>
                </div>
              </Link>
            ))}
        </div>
      )}
    </div>
  );
}
