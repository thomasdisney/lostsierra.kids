import { Fragment, useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";

function notifyClerk(item) {
  console.log(`Order part ${item.part_number} up to ${item.max_qty}`);
}

const initialConsumeState = {
  part_number: "",
  qty: "",
  tfiTicket: "",
  note: "",
};

const initialAdjustmentState = {
  requested_qty: "",
  reason: "",
};

function ExampleWMS() {
  const navigate = useNavigate();
  const [inventory, setInventory] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [viewMode, setViewMode] = useState("user");
  const [orderQueue, setOrderQueue] = useState([]);
  const [consumeForm, setConsumeForm] = useState(initialConsumeState);
  const [openAdjustmentFor, setOpenAdjustmentFor] = useState(null);
  const [adjustmentForm, setAdjustmentForm] = useState(initialAdjustmentState);
  const [shipmentInputs, setShipmentInputs] = useState({});

  const lowStockItems = useMemo(
    () => inventory.filter((item) => Number(item.current_qty) <= Number(item.min_qty)),
    [inventory]
  );

  useEffect(() => {
    fetchInventory();
  }, []);

  useEffect(() => {
    lowStockItems.forEach((item) => notifyClerk(item));
  }, [lowStockItems]);

  const findInventoryItem = (partNumber) =>
    inventory.find((item) => item.part_number === partNumber);

  const safelyParseJson = async (response) => {
    try {
      return await response.clone().json();
    } catch (parseError) {
      const fallbackText = await response.text();
      throw new Error(
        fallbackText || "Unexpected response from the server. Please try again."
      );
    }
  };

  const fetchInventory = async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch("/api/inventory");
      if (!response.ok) {
        const body = await safelyParseJson(response);
        throw new Error(body.error || "Failed to load inventory");
      }
      const data = await safelyParseJson(response);
      const nextInventory = Array.isArray(data)
        ? data
        : Array.isArray(data.inventory)
        ? data.inventory
        : [];
      setInventory(nextInventory);
      setOrderQueue(Array.isArray(data.orderQueue) ? data.orderQueue : []);
      if (!consumeForm.part_number && nextInventory.length > 0) {
        setConsumeForm((prev) => ({ ...prev, part_number: nextInventory[0].part_number }));
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleConsumeSubmit = async (e) => {
    e.preventDefault();
    const qty = Number(consumeForm.qty);
    if (!consumeForm.part_number) {
      setError("Select a part to consume.");
      return;
    }

    if (!consumeForm.tfiTicket) {
      setError("TFI Ticket # is required to consume inventory.");
      return;
    }

    if (!qty || qty <= 0) {
      setError("Enter a valid quantity to consume.");
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const response = await fetch("/api/inventory", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "consume",
          part_number: consumeForm.part_number,
          qty,
          tfiTicket: consumeForm.tfiTicket,
          note: consumeForm.note,
        }),
      });

      if (!response.ok) {
        const body = await safelyParseJson(response);
        throw new Error(body.error || "Unable to consume inventory");
      }

      await fetchInventory();
      setConsumeForm((prev) => ({ ...prev, qty: "", tfiTicket: "", note: "" }));
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleRequestAdjustment = async (partNumber) => {
    const requested_qty = Number(adjustmentForm.requested_qty);
    if (Number.isNaN(requested_qty) || requested_qty < 0) {
      setError("Enter a valid corrected quantity.");
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const response = await fetch("/api/inventory", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "request_adjustment",
          part_number: partNumber,
          requested_qty,
          reason: adjustmentForm.reason,
        }),
      });

      if (!response.ok) {
        const body = await safelyParseJson(response);
        throw new Error(body.error || "Unable to request adjustment");
      }

      const body = await safelyParseJson(response);
      setOrderQueue(Array.isArray(body.orderQueue) ? body.orderQueue : orderQueue);
      setOpenAdjustmentFor(null);
      setAdjustmentForm(initialAdjustmentState);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const ensureOrderExists = async (partNumber) => {
    const hasActiveOrder = orderQueue.some(
      (order) => order.part_number === partNumber && order.status !== "completed"
    );
    if (hasActiveOrder) {
      return orderQueue;
    }

    const item = findInventoryItem(partNumber);
    if (!item) {
      throw new Error("Part not found in inventory.");
    }

    const response = await fetch("/api/inventory", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        action: "request_adjustment",
        part_number: partNumber,
        requested_qty: item.max_qty,
        reason: "Auto-created restock request for shipping.",
      }),
    });

    if (!response.ok) {
      const body = await safelyParseJson(response);
      throw new Error(body.error || "Unable to create order for this part");
    }

    const body = await safelyParseJson(response);
    const nextQueue = Array.isArray(body.orderQueue) ? body.orderQueue : orderQueue;
    setOrderQueue(nextQueue);
    return nextQueue;
  };

  const completeShipment = async (partNumber) => {
    const qty = Number(shipmentInputs[partNumber]);
    if (!qty || qty <= 0) {
      setError("Enter a quantity shipped before completing the order.");
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const queueAfterEnsure = await ensureOrderExists(partNumber);
      const hasSentOrder = queueAfterEnsure.some(
        (order) => order.part_number === partNumber && order.status === "sent"
      );

      let queueAfterSend = queueAfterEnsure;
      if (!hasSentOrder) {
        const sendResponse = await fetch("/api/inventory", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ action: "send_order", part_number: partNumber }),
        });

        if (!sendResponse.ok) {
          const body = await safelyParseJson(sendResponse);
          throw new Error(body.error || "Unable to send order");
        }

        const body = await safelyParseJson(sendResponse);
        queueAfterSend = Array.isArray(body.orderQueue) ? body.orderQueue : queueAfterEnsure;
        setOrderQueue(queueAfterSend);
      }

      const receiveResponse = await fetch("/api/inventory", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "receive", part_number: partNumber, qty }),
      });

      if (!receiveResponse.ok) {
        const body = await safelyParseJson(receiveResponse);
        throw new Error(body.error || "Unable to complete shipment");
      }

      const body = await safelyParseJson(receiveResponse);
      setOrderQueue(Array.isArray(body.orderQueue) ? body.orderQueue : queueAfterSend);
      setShipmentInputs((prev) => ({ ...prev, [partNumber]: "" }));
      await fetchInventory();
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-[#f8fafc] via-[#eef2ff] to-[#e0f2fe] text-slate-800">
      <div className="mx-auto max-w-6xl px-6 py-10 space-y-8">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <button
            type="button"
            onClick={() => navigate("/")}
            className="text-sm text-blue-700 hover:text-blue-900 transition"
          >
            ← Back to home
          </button>
          <div className="flex items-center gap-3 bg-white/90 rounded-full border border-slate-200 shadow-md p-1.5">
            {[
              { label: "User view", value: "user" },
              { label: "Shipping clerk", value: "shippingClerk" },
            ].map((mode) => (
              <button
                key={mode.value}
                onClick={() => setViewMode(mode.value)}
                className={`px-4 py-2 text-sm font-medium rounded-full transition shadow-sm ${
                  viewMode === mode.value
                    ? "bg-blue-600 text-white"
                    : "text-slate-700 hover:bg-slate-100"
                }`}
              >
                {mode.label}
              </button>
            ))}
          </div>
        </div>

        <div className="flex flex-col gap-2">
          <h1 className="text-3xl font-bold tracking-tight text-slate-900">
            Example Warehouse Management
          </h1>
          <p className="text-base text-slate-600 leading-relaxed">
            {viewMode === "user"
              ? "Use consume and audit tools to keep live inventory aligned with work orders."
              : "Ship only what is requested and complete restock orders without directly editing inventory."}
          </p>
        </div>

        {lowStockItems.length > 0 && (
          <div className="p-5 bg-gradient-to-r from-amber-50 via-amber-50 to-orange-50 border border-amber-100 text-amber-800 rounded-2xl shadow-sm">
            <p className="font-semibold">Low stock alert!</p>
            <ul className="list-disc list-inside text-sm leading-relaxed">
              {lowStockItems.map((item) => (
                <li key={item.part_number}>
                  {item.part_number} - current {item.current_qty}, min {item.min_qty}
                </li>
              ))}
            </ul>
          </div>
        )}

        {error && (
          <div className="p-3 rounded-md bg-red-50 border border-red-200 text-red-700">
            Error: {error}
          </div>
        )}
        {viewMode === "user" ? (
          <div className="space-y-6">
            <section className="bg-white/95 backdrop-blur-sm border border-slate-200 rounded-2xl shadow-lg p-6 space-y-5">
              <div className="flex flex-col gap-2">
                <h2 className="text-xl font-semibold text-slate-900">Consume tool</h2>
                <p className="text-sm text-slate-600">
                  Submit consumption with the same validation as before, now organized in a single sentence.
                </p>
              </div>
              <form onSubmit={handleConsumeSubmit} className="space-y-4">
                <div className="flex flex-col gap-3">
                  <label className="text-sm font-medium text-slate-800">
                    I am consuming
                    <div className="mt-2 flex flex-col gap-3 md:flex-row md:items-center md:gap-2">
                      <input
                        type="text"
                        inputMode="numeric"
                        value={consumeForm.qty}
                        onChange={(e) => setConsumeForm((prev) => ({ ...prev, qty: e.target.value }))}
                        placeholder="Qty"
                        className="w-full md:w-24 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm focus:border-blue-400 focus:outline-none"
                      />
                      <select
                        value={consumeForm.part_number}
                        onChange={(e) => setConsumeForm((prev) => ({ ...prev, part_number: e.target.value }))}
                        className="w-full md:w-48 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm focus:border-blue-400 focus:outline-none"
                      >
                        {inventory.map((item) => (
                          <option key={item.part_number} value={item.part_number}>
                            {item.part_number} - {item.description}
                          </option>
                        ))}
                      </select>
                      <span className="text-sm font-medium text-slate-700">for</span>
                      <input
                        type="text"
                        value={consumeForm.tfiTicket}
                        onChange={(e) => setConsumeForm((prev) => ({ ...prev, tfiTicket: e.target.value }))}
                        placeholder="TFI Ticket #"
                        className="w-full md:w-48 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm focus:border-blue-400 focus:outline-none"
                      />
                      <span className="text-sm font-medium text-slate-700">.</span>
                    </div>
                  </label>
                </div>
                <div className="grid gap-3 md:grid-cols-2">
                  <div className="flex flex-col gap-1">
                    <label className="text-xs font-semibold uppercase text-slate-500">Optional note</label>
                    <input
                      type="text"
                      value={consumeForm.note}
                      onChange={(e) => setConsumeForm((prev) => ({ ...prev, note: e.target.value }))}
                      placeholder="Note for the shipping clerk"
                      className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm focus:border-blue-400 focus:outline-none"
                    />
                  </div>
                </div>
                <button
                  type="submit"
                  disabled={loading}
                  className="rounded-lg bg-rose-500 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-rose-600 disabled:opacity-70"
                >
                  Submit consumption
                </button>
              </form>
            </section>

            <section className="bg-white/95 backdrop-blur-sm border border-slate-200 rounded-2xl shadow-lg">
              <div className="flex items-center justify-between px-6 py-4">
                <div>
                  <h2 className="text-xl font-semibold text-slate-900">Audit tool</h2>
                  <p className="text-sm text-slate-600">Review the full inventory and request corrections.</p>
                </div>
              </div>
              <div className="overflow-x-auto">
                <table className="min-w-full text-left text-sm">
                  <thead className="bg-slate-50 text-slate-600 uppercase tracking-wide text-xs">
                    <tr>
                      <th className="p-4">Part Number</th>
                      <th className="p-4">Description</th>
                      <th className="p-4">Current Qty</th>
                      <th className="p-4">Min</th>
                      <th className="p-4">Max</th>
                      <th className="p-4">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {inventory.map((item) => (
                      <Fragment key={item.part_number}>
                        <tr className="bg-white hover:bg-slate-50/60 transition">
                          <td className="p-4 font-semibold text-slate-900">{item.part_number}</td>
                          <td className="p-4 text-slate-700 max-w-xs">{item.description}</td>
                          <td className="p-4 text-slate-900">{item.current_qty}</td>
                          <td className="p-4 text-slate-900">{item.min_qty}</td>
                          <td className="p-4 text-slate-900">{item.max_qty}</td>
                          <td className="p-4">
                            <button
                              type="button"
                              onClick={() => {
                                setOpenAdjustmentFor(item.part_number);
                                setAdjustmentForm({
                                  requested_qty: item.current_qty,
                                  reason: "",
                                });
                              }}
                              className="rounded-lg bg-indigo-500 px-3 py-2 text-sm font-semibold text-white shadow-sm hover:bg-indigo-600"
                            >
                              Request Adjustment
                            </button>
                          </td>
                        </tr>
                        {openAdjustmentFor === item.part_number && (
                          <tr className="bg-slate-50">
                            <td colSpan={6} className="p-4">
                              <div className="grid gap-4 md:grid-cols-4 items-end">
                                <div className="space-y-1">
                                  <label className="text-xs font-semibold uppercase text-slate-500">Part</label>
                                  <input
                                    type="text"
                                    value={`${item.part_number} — ${item.description}`}
                                    disabled
                                    className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm"
                                  />
                                </div>
                                <div className="space-y-1">
                                  <label className="text-xs font-semibold uppercase text-slate-500">Current quantity</label>
                                  <input
                                    type="text"
                                    value={item.current_qty}
                                    disabled
                                    className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm"
                                  />
                                </div>
                                <div className="space-y-1">
                                  <label className="text-xs font-semibold uppercase text-slate-500">Correct quantity</label>
                                  <input
                                    type="text"
                                    inputMode="numeric"
                                    value={adjustmentForm.requested_qty}
                                    onChange={(e) =>
                                      setAdjustmentForm((prev) => ({
                                        ...prev,
                                        requested_qty: e.target.value,
                                      }))
                                    }
                                    className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm focus:border-blue-400 focus:outline-none"
                                  />
                                </div>
                                <div className="space-y-1 md:col-span-1">
                                  <label className="text-xs font-semibold uppercase text-slate-500">Reason</label>
                                  <textarea
                                    value={adjustmentForm.reason}
                                    onChange={(e) =>
                                      setAdjustmentForm((prev) => ({ ...prev, reason: e.target.value }))
                                    }
                                    rows={2}
                                    className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm focus:border-blue-400 focus:outline-none"
                                  />
                                </div>
                              </div>
                              <div className="mt-3 flex flex-wrap gap-3">
                                <button
                                  type="button"
                                  onClick={() => handleRequestAdjustment(item.part_number)}
                                  disabled={loading}
                                  className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-blue-700 disabled:opacity-70"
                                >
                                  Submit request
                                </button>
                                <button
                                  type="button"
                                  onClick={() => {
                                    setOpenAdjustmentFor(null);
                                    setAdjustmentForm(initialAdjustmentState);
                                  }}
                                  className="rounded-lg border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-100"
                                >
                                  Cancel
                                </button>
                              </div>
                            </td>
                          </tr>
                        )}
                      </Fragment>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>
          </div>
        ) : (
          <div className="space-y-6">
            <section className="bg-white/95 backdrop-blur-sm border border-slate-200 rounded-2xl shadow-lg">
              <div className="flex items-center justify-between px-6 py-4">
                <div>
                  <h2 className="text-xl font-semibold text-slate-900">Items requiring shipment</h2>
                  <p className="text-sm text-slate-600">Only items at or below minimum are shown. Enter what you shipped to update inventory.</p>
                </div>
              </div>
              <div className="overflow-x-auto">
                <table className="min-w-full text-left text-sm">
                  <thead className="bg-slate-50 text-slate-600 uppercase tracking-wide text-xs">
                    <tr>
                      <th className="p-4">Part Number</th>
                      <th className="p-4">Description</th>
                      <th className="p-4">Current / Min / Max</th>
                      <th className="p-4">Quantity Shipped</th>
                      <th className="p-4">Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {lowStockItems.length === 0 && (
                      <tr>
                        <td colSpan={5} className="p-4 text-sm text-slate-600">
                          All parts are above minimums.
                        </td>
                      </tr>
                    )}
                    {lowStockItems.map((item) => (
                      <tr key={item.part_number} className="bg-white">
                        <td className="p-4 font-semibold text-slate-900">{item.part_number}</td>
                        <td className="p-4 text-slate-700 max-w-xs">{item.description}</td>
                        <td className="p-4 text-slate-900">
                          <div className="text-sm font-medium">{item.current_qty}</div>
                          <div className="text-xs text-slate-500">Min {item.min_qty} · Max {item.max_qty}</div>
                        </td>
                        <td className="p-4">
                          <input
                            type="text"
                            inputMode="numeric"
                            value={shipmentInputs[item.part_number] || ""}
                            onChange={(e) =>
                              setShipmentInputs((prev) => ({
                                ...prev,
                                [item.part_number]: e.target.value,
                              }))
                            }
                            placeholder="Qty shipped"
                            className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm focus:border-blue-400 focus:outline-none"
                          />
                        </td>
                        <td className="p-4">
                          <button
                            type="button"
                            onClick={() => completeShipment(item.part_number)}
                            disabled={loading}
                            className="rounded-lg bg-emerald-500 px-3 py-2 text-sm font-semibold text-white shadow-sm hover:bg-emerald-600 disabled:opacity-70"
                          >
                            Complete Order
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>

            <section className="bg-white/95 border border-slate-200 rounded-2xl shadow-lg p-6 space-y-4">
              <div className="flex items-center gap-2">
                <h2 className="text-lg font-semibold text-slate-900">Shipping clerk queue</h2>
                <span className="text-xs text-slate-500">Includes low-stock and adjustment requests.</span>
              </div>
              {orderQueue.length === 0 ? (
                <p className="text-sm text-slate-600">No pending requests yet.</p>
              ) : (
                <ul className="divide-y divide-slate-100">
                  {orderQueue.map((request) => (
                    <li key={`${request.part_number}-${request.id || request.created_at}`} className="py-3 flex flex-col gap-1">
                      <div className="flex items-center gap-2 text-sm font-semibold text-slate-900">
                        <span>{request.part_number}</span>
                        <span className="text-slate-500">·</span>
                        <span className="font-normal text-slate-700">{request.description}</span>
                        <span className="ml-auto text-xs uppercase tracking-wide rounded-full px-2 py-1 bg-slate-100 text-slate-600">
                          {request.status}
                        </span>
                      </div>
                      <p className="text-sm text-slate-700">{request.note}</p>
                    </li>
                  ))}
                </ul>
              )}
            </section>
          </div>
        )}
      </div>
    </div>
  );
}

export default ExampleWMS;
