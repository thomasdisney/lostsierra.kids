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
  guardian: { fullName: string; email: string } | null;
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

export default function AdminInvoicesPage() {
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState("all");

  useEffect(() => {
    load();
  }, []);

  async function load() {
    const res = await fetch("/portal/api/admin/invoices");
    const data = await res.json();
    setInvoices(data.invoices || []);
    setLoading(false);
  }

  async function sendInvoice(id: string) {
    await fetch(`/portal/api/admin/invoices/${id}/send`, { method: "POST" });
    load();
  }

  if (loading) {
    return (
      <div className="flex h-64 items-center justify-center">
        <div className="text-forest-500">Loading...</div>
      </div>
    );
  }

  const filtered =
    filter === "all" ? invoices : invoices.filter((i) => i.status === filter);

  const totalOutstanding = invoices
    .filter((i) => i.status === "sent" || i.status === "overdue")
    .reduce((sum, i) => sum + (i.total - i.totalPaid), 0);

  return (
    <div>
      <div className="mb-8 flex items-center justify-between">
        <div>
          <h1 className="mb-1 text-2xl font-bold text-forest-900">Invoices</h1>
          <p className="text-forest-600">
            Outstanding: {formatMoney(totalOutstanding)}
          </p>
        </div>
        <Link
          href="/admin/invoices/new"
          className="rounded-lg bg-forest-700 px-4 py-2 text-sm font-medium text-white transition hover:bg-forest-600"
        >
          New Invoice
        </Link>
      </div>

      <div className="mb-4 flex gap-2">
        {["all", "draft", "sent", "paid", "overdue"].map((f) => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={`rounded-lg px-3 py-1.5 text-xs font-medium transition ${
              filter === f
                ? "bg-forest-700 text-white"
                : "bg-paper-100 text-forest-600 hover:bg-paper-200"
            }`}
          >
            {f === "all" ? "All" : f.charAt(0).toUpperCase() + f.slice(1)}
          </button>
        ))}
      </div>

      <div className="rounded-xl border border-paper-200 bg-white">
        {filtered.length === 0 ? (
          <div className="p-8 text-center text-forest-500">No invoices</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-paper-200 text-left">
                  <th className="px-4 py-3 font-medium text-forest-600">
                    Invoice
                  </th>
                  <th className="px-4 py-3 font-medium text-forest-600">
                    Family
                  </th>
                  <th className="px-4 py-3 font-medium text-forest-600">
                    Amount
                  </th>
                  <th className="px-4 py-3 font-medium text-forest-600">
                    Status
                  </th>
                  <th className="px-4 py-3 font-medium text-forest-600">
                    Due
                  </th>
                  <th className="px-4 py-3 font-medium text-forest-600">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((inv) => (
                  <tr
                    key={inv.id}
                    className="border-b border-paper-100 last:border-0"
                  >
                    <td className="px-4 py-3 font-medium text-forest-900">
                      <Link
                        href={`/admin/invoices/${inv.id}`}
                        className="hover:text-forest-600"
                      >
                        {inv.invoiceNumber}
                      </Link>
                    </td>
                    <td className="px-4 py-3 text-forest-600">
                      {inv.guardian?.fullName}
                    </td>
                    <td className="px-4 py-3 font-medium text-forest-900">
                      {formatMoney(inv.total)}
                    </td>
                    <td className="px-4 py-3">
                      <span
                        className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${
                          statusColors[inv.status] || ""
                        }`}
                      >
                        {inv.status}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-forest-500">
                      {inv.dueDate
                        ? new Date(inv.dueDate + "T00:00:00").toLocaleDateString()
                        : "—"}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex gap-2">
                        {inv.status === "draft" && (
                          <button
                            onClick={() => sendInvoice(inv.id)}
                            className="text-xs font-medium text-forest-600 hover:text-forest-800"
                          >
                            Send
                          </button>
                        )}
                        <Link
                          href={`/admin/invoices/${inv.id}`}
                          className="text-xs font-medium text-forest-600 hover:text-forest-800"
                        >
                          View
                        </Link>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
