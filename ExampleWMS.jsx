import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";

function notifyClerk(item) {
  console.log(`Order part ${item.part_number} up to ${item.max_qty}`);
}

const initialFormState = {
  part_number: "",
  description: "",
  current_qty: "",
  min_qty: "",
  max_qty: "",
};

function ExampleWMS() {
  const navigate = useNavigate();
  const [inventory, setInventory] = useState([]);
  const [formData, setFormData] = useState(initialFormState);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [viewMode, setViewMode] = useState("user");
  const [orderQueue, setOrderQueue] = useState([]);
  const [actionInputs, setActionInputs] = useState({});

  const lowStockItems = useMemo(
    () => inventory.filter((item) => Number(item.current_qty) <= Number(item.min_qty)),
    [inventory]
  );

  const openOrders = useMemo(
    () => orderQueue.filter((order) => order.status === "open"),
    [orderQueue]
  );

  useEffect(() => {
    fetchInventory();
  }, []);

  useEffect(() => {
    lowStockItems.forEach((item) => notifyClerk(item));
  }, [lowStockItems]);

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
      setInventory(Array.isArray(data) ? data : []);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    const payload = {
      part_number: formData.part_number,
      description: formData.description,
      current_qty: Number(formData.current_qty),
      min_qty: Number(formData.min_qty),
      max_qty: Number(formData.max_qty),
    };

    try {
      const response = await fetch("/api/inventory", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        const body = await safelyParseJson(response);
        throw new Error(body.error || "Unable to save item");
      }

      await fetchInventory();
      setFormData(initialFormState);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const updateActionInputs = (partNumber, field, value) => {
    setActionInputs((prev) => ({
      ...prev,
      [partNumber]: {
        consumeQty: "",
        receiveQty: "",
        tfiTicket: "",
        note: "",
        minEdit: "",
        maxEdit: "",
        ...prev[partNumber],
        [field]: value,
      },
    }));
  };

  const handleConsume = (item) => {
    const inputs = actionInputs[item.part_number] || {};
    const qty = Number(inputs.consumeQty);

    if (!inputs.tfiTicket) {
      setError("TFI Ticket # is required to consume inventory.");
      return;
    }

    if (!qty || qty <= 0) {
      setError("Enter a valid quantity to consume.");
      return;
    }

    setError(null);

    setInventory((prev) =>
      prev.map((invItem) => {
        if (invItem.part_number !== item.part_number) return invItem;
        const newQty = Math.max(0, Number(invItem.current_qty) - qty);
        const updated = { ...invItem, current_qty: newQty };

        if (newQty <= Number(invItem.min_qty)) {
          const note =
            inputs.note ||
            `Hit minimum after consuming ${qty} (Ticket #${inputs.tfiTicket}).`;
          setOrderQueue((queue) => {
            const hasPendingOrder = queue.some(
              (order) =>
                order.part_number === invItem.part_number && order.status !== "completed"
            );

            if (hasPendingOrder) return queue;

            return [
              ...queue,
              {
                part_number: invItem.part_number,
                description: invItem.description,
                note,
                status: "open",
              },
            ];
          });
        }

        return updated;
      })
    );

    setActionInputs((prev) => ({
      ...prev,
      [item.part_number]: {
        ...prev[item.part_number],
        consumeQty: "",
        tfiTicket: "",
        note: "",
      },
    }));
  };

  const handleReceive = (item) => {
    const inputs = actionInputs[item.part_number] || {};
    const qty = Number(inputs.receiveQty);

    const hasSentOrder = orderQueue.some(
      (order) => order.part_number === item.part_number && order.status === "sent"
    );

    if (!qty || qty <= 0) {
      setError("Enter a valid quantity to receive.");
      return;
    }

    if (!hasSentOrder) {
      setError("Shipping clerk must send an order before receiving this item.");
      return;
    }

    setError(null);

    setInventory((prev) =>
      prev.map((invItem) =>
        invItem.part_number === item.part_number
          ? { ...invItem, current_qty: Number(invItem.current_qty) + qty }
          : invItem
      )
    );

    setOrderQueue((queue) =>
      queue
        .map((order) =>
          order.part_number === item.part_number && order.status === "sent"
            ? { ...order, status: "completed" }
            : order
        )
        .filter((order) => order.status !== "completed")
    );

    setActionInputs((prev) => ({
      ...prev,
      [item.part_number]: {
        ...prev[item.part_number],
        receiveQty: "",
      },
    }));
  };

  const handleThresholdUpdate = async (item) => {
    const inputs = actionInputs[item.part_number] || {};
    const nextMin = inputs.minEdit === "" ? item.min_qty : Number(inputs.minEdit);
    const nextMax = inputs.maxEdit === "" ? item.max_qty : Number(inputs.maxEdit);

    setLoading(true);
    setError(null);

    try {
      const response = await fetch("/api/inventory", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          part_number: item.part_number,
          description: item.description,
          current_qty: Number(item.current_qty),
          min_qty: nextMin,
          max_qty: nextMax,
        }),
      });

      if (!response.ok) {
        const body = await safelyParseJson(response);
        throw new Error(body.error || "Unable to update thresholds");
      }

      await fetchInventory();
      setActionInputs((prev) => ({
        ...prev,
        [item.part_number]: {
          ...prev[item.part_number],
          minEdit: "",
          maxEdit: "",
        },
      }));
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const reorderToMax = async (item) => {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch("/api/inventory", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ part_number: item.part_number }),
      });

      if (!response.ok) {
        const body = await safelyParseJson(response);
        throw new Error(body.error || "Unable to reorder item");
      }

      await fetchInventory();
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleSendOrder = (partNumber) => {
    setOrderQueue((queue) =>
      queue.map((order) =>
        order.part_number === partNumber && order.status === "open"
          ? { ...order, status: "sent" }
          : order
      )
    );
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
              ? "View live inventory, receive stock, and consume with a TFI Ticket #."
              : "Adjust min/max thresholds, add new parts, and process reorder requests."}
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

        {viewMode === "shippingClerk" && (
          <form
            onSubmit={handleSubmit}
            className="space-y-5 bg-white/90 backdrop-blur-sm border border-slate-200 p-6 rounded-2xl shadow-lg"
          >
            <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
              <input
                type="text"
                name="part_number"
                placeholder="Part Number"
                value={formData.part_number}
                onChange={handleChange}
                className="p-3 border border-slate-200 rounded-lg bg-slate-50 focus:bg-white focus:border-blue-400 focus:outline-none"
                required
              />
              <input
                type="text"
                name="description"
                placeholder="Description"
                value={formData.description}
                onChange={handleChange}
                className="p-3 border border-slate-200 rounded-lg bg-slate-50 focus:bg-white focus:border-blue-400 focus:outline-none"
                required
              />
              <input
                type="number"
                name="current_qty"
                placeholder="Current Qty"
                value={formData.current_qty}
                onChange={handleChange}
                className="p-3 border border-slate-200 rounded-lg bg-slate-50 focus:bg-white focus:border-blue-400 focus:outline-none"
                required
              />
              <input
                type="number"
                name="min_qty"
                placeholder="Min Qty"
                value={formData.min_qty}
                onChange={handleChange}
                className="p-3 border border-slate-200 rounded-lg bg-slate-50 focus:bg-white focus:border-blue-400 focus:outline-none"
                required
              />
              <input
                type="number"
                name="max_qty"
                placeholder="Max Qty"
                value={formData.max_qty}
                onChange={handleChange}
                className="p-3 border border-slate-200 rounded-lg bg-slate-50 focus:bg-white focus:border-blue-400 focus:outline-none"
                required
              />
            </div>
            <div className="flex flex-wrap gap-3 items-center">
              <button
                type="submit"
                className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition shadow-md"
                disabled={loading}
              >
                {loading ? "Saving..." : "Add / Update Item"}
              </button>
              <p className="text-sm text-slate-500">
                Shipping clerks can add new parts and adjust thresholds.
              </p>
            </div>
          </form>
        )}

        <div className="bg-white/95 backdrop-blur-sm border border-slate-200 rounded-2xl shadow-lg overflow-hidden">
          <div className="overflow-x-auto">
            <table className="min-w-full text-left text-sm">
              <thead className="bg-slate-50 text-slate-600 uppercase tracking-wide text-xs">
                <tr>
                  <th className="p-4">Part Number</th>
                  <th className="p-4">Description</th>
                  <th className="p-4">Current Qty</th>
                  <th className="p-4">Min Qty</th>
                  <th className="p-4">Max Qty</th>
                  <th className="p-4">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {inventory.map((item) => {
                  const hasSentOrder = orderQueue.some(
                    (order) => order.part_number === item.part_number && order.status === "sent"
                  );

                  return (
                    <tr
                      key={item.part_number}
                      className="bg-white hover:bg-slate-50/60 transition"
                    >
                      <td className="p-4 font-semibold text-slate-900">{item.part_number}</td>
                      <td className="p-4 text-slate-700 max-w-xs">{item.description}</td>
                      <td className="p-4 text-slate-900">{item.current_qty}</td>
                      <td className="p-4 text-slate-900">{item.min_qty}</td>
                      <td className="p-4 text-slate-900">{item.max_qty}</td>
                      <td className="p-4">
                        {viewMode === "user" ? (
                          <div className="grid gap-4 sm:grid-cols-2">
                            <div className="space-y-2 bg-slate-50 border border-slate-200 rounded-xl p-3">
                              <p className="text-xs font-semibold text-slate-600 uppercase tracking-wide">
                                Consume
                              </p>
                              <div className="flex flex-col gap-2">
                                <input
                                  type="number"
                                  min="1"
                                  value={actionInputs[item.part_number]?.consumeQty || ""}
                                  onChange={(e) =>
                                    updateActionInputs(item.part_number, "consumeQty", e.target.value)
                                  }
                                  placeholder="Qty"
                                  className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm focus:border-blue-400 focus:outline-none"
                                />
                                <input
                                  type="text"
                                  value={actionInputs[item.part_number]?.tfiTicket || ""}
                                  onChange={(e) =>
                                    updateActionInputs(item.part_number, "tfiTicket", e.target.value)
                                  }
                                  placeholder="TFI Ticket #"
                                  className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm focus:border-blue-400 focus:outline-none"
                                />
                                <input
                                  type="text"
                                  value={actionInputs[item.part_number]?.note || ""}
                                  onChange={(e) =>
                                    updateActionInputs(item.part_number, "note", e.target.value)
                                  }
                                  placeholder="Note for clerk"
                                  className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm focus:border-blue-400 focus:outline-none"
                                />
                                <button
                                  onClick={() => handleConsume(item)}
                                  className="rounded-lg bg-rose-500 px-3 py-2 text-sm font-semibold text-white shadow-sm hover:bg-rose-600 disabled:opacity-70"
                                  disabled={loading}
                                  type="button"
                                >
                                  Consume
                                </button>
                              </div>
                            </div>
                            <div className="space-y-2 bg-slate-50 border border-slate-200 rounded-xl p-3">
                              <p className="text-xs font-semibold text-slate-600 uppercase tracking-wide">
                                Receive
                              </p>
                              <div className="flex flex-col gap-2">
                                <input
                                  type="number"
                                  min="1"
                                  value={actionInputs[item.part_number]?.receiveQty || ""}
                                  onChange={(e) =>
                                    updateActionInputs(item.part_number, "receiveQty", e.target.value)
                                  }
                                  placeholder="Qty"
                                  className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm focus:border-blue-400 focus:outline-none"
                                />
                                <button
                                  onClick={() => handleReceive(item)}
                                  className="rounded-lg bg-emerald-500 px-3 py-2 text-sm font-semibold text-white shadow-sm hover:bg-emerald-600 disabled:opacity-70"
                                  disabled={loading || !hasSentOrder}
                                  type="button"
                                >
                                  Receive
                                </button>
                                {!hasSentOrder && (
                                  <p className="text-xs text-slate-500">
                                    Waiting for shipping clerk to send this order.
                                  </p>
                                )}
                              </div>
                            </div>
                          </div>
                        ) : (
                          <div className="grid gap-4 lg:grid-cols-3">
                            <div className="space-y-2">
                              <label className="text-xs text-slate-500">Min Qty</label>
                              <input
                                type="number"
                                value={actionInputs[item.part_number]?.minEdit ?? ""}
                                onChange={(e) =>
                                  updateActionInputs(item.part_number, "minEdit", e.target.value)
                                }
                                placeholder={item.min_qty}
                                className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm focus:border-blue-400 focus:outline-none"
                              />
                            </div>
                            <div className="space-y-2">
                              <label className="text-xs text-slate-500">Max Qty</label>
                              <input
                                type="number"
                                value={actionInputs[item.part_number]?.maxEdit ?? ""}
                                onChange={(e) =>
                                  updateActionInputs(item.part_number, "maxEdit", e.target.value)
                                }
                                placeholder={item.max_qty}
                                className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm focus:border-blue-400 focus:outline-none"
                              />
                            </div>
                            <div className="flex flex-col gap-2">
                              <button
                                onClick={() => handleThresholdUpdate(item)}
                                className="rounded-lg bg-blue-600 px-3 py-2 text-sm font-semibold text-white shadow-sm hover:bg-blue-700 disabled:opacity-70"
                                disabled={loading}
                                type="button"
                              >
                                Save Min/Max
                              </button>
                              <button
                                className="rounded-lg bg-indigo-500 px-3 py-2 text-sm font-semibold text-white shadow-sm hover:bg-indigo-600 disabled:opacity-70"
                                onClick={() => reorderToMax(item)}
                                disabled={loading}
                                type="button"
                              >
                                Reorder to Max
                              </button>
                            </div>
                          </div>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>

        {viewMode === "shippingClerk" && (
          <div className="bg-white/90 border border-slate-200 rounded-2xl shadow-lg p-6 space-y-4">
            <div className="flex items-center gap-2">
              <h2 className="text-lg font-semibold text-slate-900">Order request queue</h2>
              <span className="text-xs text-slate-500">(auto-filled when users reach minimum)</span>
            </div>
            {openOrders.length === 0 ? (
              <p className="text-sm text-slate-600">No pending requests yet.</p>
            ) : (
              <ul className="divide-y divide-slate-100">
                {openOrders.map((request, idx) => (
                  <li key={`${request.part_number}-${idx}`} className="py-3 flex flex-col gap-1">
                    <div className="flex items-center gap-2 text-sm font-semibold text-slate-900">
                      <span>{request.part_number}</span>
                      <span className="text-slate-500">·</span>
                      <span className="font-normal text-slate-700">{request.description}</span>
                    </div>
                    <p className="text-sm text-slate-700">{request.note}</p>
                    <div className="flex gap-2">
                      <button
                        type="button"
                        onClick={() => handleSendOrder(request.part_number)}
                        className="text-sm text-white bg-indigo-500 hover:bg-indigo-600 px-3 py-1.5 rounded-lg shadow-sm transition"
                      >
                        Send order
                      </button>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

export default ExampleWMS;
