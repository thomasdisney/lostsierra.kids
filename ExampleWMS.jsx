import { Fragment, useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";

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
  const [viewMode, setViewMode] = useState("fieldTech");
  const [orderQueue, setOrderQueue] = useState([]);
  const [consumeForm, setConsumeForm] = useState(initialConsumeState);
  const [openAdjustmentFor, setOpenAdjustmentFor] = useState(null);
  const [adjustmentForm, setAdjustmentForm] = useState(initialAdjustmentState);
  const [shipmentInputs, setShipmentInputs] = useState({});
  const [inventoryManagerOpen, setInventoryManagerOpen] = useState(false);
  const [inventoryEdits, setInventoryEdits] = useState([]);
  const [auditOpen, setAuditOpen] = useState(false);
  const [autoOrderNotices, setAutoOrderNotices] = useState([]);
  const [bomOpen, setBomOpen] = useState(false);
  const [receiveInputs, setReceiveInputs] = useState({});

  const lowStockItems = useMemo(
    () => inventory.filter((item) => Number(item.current_qty) <= Number(item.min_qty)),
    [inventory]
  );

  const pendingAdjustments = useMemo(
    () =>
      orderQueue.filter(
        (request) =>
          request.request_type === "adjustment" && (request.status === "pending" || !request.status)
      ),
    [orderQueue]
  );

  const restockOrders = useMemo(
    () => orderQueue.filter((request) => request.request_type === "restock"),
    [orderQueue]
  );

  const openRestockOrders = useMemo(
    () => restockOrders.filter((request) => request.status === "open"),
    [restockOrders]
  );

  const sentRestockOrders = useMemo(
    () => restockOrders.filter((request) => request.status === "sent"),
    [restockOrders]
  );

  useEffect(() => {
    fetchInventory();
  }, []);

  useEffect(() => {
    let isActive = true;
    const createAutoOrders = async () => {
      if (lowStockItems.length === 0) {
        setAutoOrderNotices([]);
        return;
      }

      const notices = [];
      for (const item of lowStockItems) {
        try {
          await ensureRestockOrder(
            item.part_number,
            "Auto-created after hitting minimum threshold."
          );
          notices.push(`Restock order has been created for ${item.part_number}.`);
        } catch (orderError) {
          if (isActive) {
            setError(orderError.message);
          }
        }
      }

      if (isActive) {
        setAutoOrderNotices(notices);
      }
    };

    createAutoOrders();

    return () => {
      isActive = false;
    };
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
      setInventoryEdits([
        ...nextInventory.map((item) => ({
          ...item,
          original_part_number: item.part_number,
        })),
        {
          part_number: "",
          description: "",
          current_qty: "",
          min_qty: "",
          max_qty: "",
          original_part_number: null,
        },
      ]);
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

  const ensureRestockOrder = async (partNumber, reason = "") => {
    const hasActiveOrder = orderQueue.some(
      (order) =>
        order.part_number === partNumber &&
        order.request_type === "restock" &&
        order.status !== "completed"
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
        reason: reason || "Field Tech created restock request.",
        request_type: "restock",
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
      const queueAfterEnsure = await ensureRestockOrder(partNumber);
      const hasSentOrder = queueAfterEnsure.some(
        (order) => order.part_number === partNumber && order.status === "sent"
      );

      if (hasSentOrder) {
        setError("Order is already marked as sent. Field Techs will handle receiving.");
        return;
      }

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
      const nextQueue = Array.isArray(body.orderQueue) ? body.orderQueue : queueAfterEnsure;
      setOrderQueue(nextQueue);
      setShipmentInputs((prev) => ({ ...prev, [partNumber]: "" }));
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleCreateOrder = async (partNumber) => {
    if (!partNumber) {
      setError("Select a part to create an order.");
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const queueAfterEnsure = await ensureRestockOrder(
        partNumber,
        "Field Tech created this order manually."
      );
      setOrderQueue(queueAfterEnsure);
      setAutoOrderNotices((prev) => {
        const next = new Set(prev);
        next.add(`Restock order has been created for ${partNumber}.`);
        return Array.from(next);
      });
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleReceive = async (partNumber, fallbackQty) => {
    const qty = Number(receiveInputs[partNumber] ?? fallbackQty);
    if (!qty || qty <= 0) {
      setError("Enter a quantity received before completing receipt.");
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const response = await fetch("/api/inventory", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "receive", part_number: partNumber, qty }),
      });

      if (!response.ok) {
        const body = await safelyParseJson(response);
        throw new Error(body.error || "Unable to receive shipment");
      }

      const body = await safelyParseJson(response);
      setOrderQueue(Array.isArray(body.orderQueue) ? body.orderQueue : orderQueue);
      setReceiveInputs((prev) => ({ ...prev, [partNumber]: "" }));
      await fetchInventory();
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const updateInventoryEdit = (index, field, value) => {
    setInventoryEdits((prev) => {
      const next = [...prev];
      next[index] = { ...next[index], [field]: value };
      return next;
    });
  };

  const saveInventoryRow = async (rowIndex) => {
    const row = inventoryEdits[rowIndex];
    const payload = {
      part_number: String(row.part_number || "").trim(),
      description: String(row.description || "").trim(),
      current_qty: Number(row.current_qty),
      min_qty: Number(row.min_qty),
      max_qty: Number(row.max_qty),
    };

    if (
      !payload.part_number ||
      !payload.description ||
      Number.isNaN(payload.current_qty) ||
      Number.isNaN(payload.min_qty) ||
      Number.isNaN(payload.max_qty)
    ) {
      setError("Fill in part number, description, and numeric quantities for this row.");
      return;
    }

    setLoading(true);
    setError(null);

    const isRename =
      row.original_part_number && row.original_part_number !== payload.part_number;

    try {
      const response = await fetch("/api/inventory", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(
          isRename
            ? { action: "rename_part", old_part_number: row.original_part_number, ...payload }
            : payload
        ),
      });

      if (!response.ok) {
        const body = await safelyParseJson(response);
        throw new Error(body.error || "Unable to save inventory changes");
      }

      await fetchInventory();
      setInventoryManagerOpen(true);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const addBlankInventoryRow = () => {
    setInventoryEdits((prev) => [
      ...prev,
      {
        part_number: "",
        description: "",
        current_qty: 0,
        min_qty: 0,
        max_qty: 0,
        original_part_number: null,
      },
    ]);
  };

  const handleApproveAdjustment = async (id) => {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch("/api/inventory", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "approve_adjustment", id }),
      });

      if (!response.ok) {
        const body = await safelyParseJson(response);
        throw new Error(body.error || "Unable to approve adjustment");
      }

      await fetchInventory();
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleDenyAdjustment = async (id) => {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch("/api/inventory", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "deny_adjustment", id }),
      });

      if (!response.ok) {
        const body = await safelyParseJson(response);
        throw new Error(body.error || "Unable to deny adjustment");
      }

      const body = await safelyParseJson(response);
      setOrderQueue(Array.isArray(body.orderQueue) ? body.orderQueue : orderQueue);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-950 via-slate-900 to-slate-800 text-slate-100">
      <div className="mx-auto max-w-6xl px-6 py-10 space-y-8">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <button
            type="button"
            onClick={() => navigate("/")}
            className="text-sm text-amber-400 hover:text-amber-200 transition"
          >
            ← Back to home
          </button>
          <div className="flex items-center gap-3 bg-slate-800/80 rounded-full border border-slate-700 shadow-md p-1.5">
            {[
              { label: "Field Tech", value: "fieldTech" },
              { label: "Shipping clerk", value: "shippingClerk" },
            ].map((mode) => (
              <button
                key={mode.value}
                onClick={() => setViewMode(mode.value)}
                className={`px-4 py-2 text-sm font-semibold rounded-full transition shadow-sm ${
                  viewMode === mode.value
                    ? "bg-amber-500 text-slate-900"
                    : "text-slate-200 hover:bg-slate-700"
                }`}
              >
                {mode.label}
              </button>
            ))}
          </div>
        </div>

        <div className="flex flex-col gap-2">
          <h1 className="text-3xl font-extrabold tracking-tight text-amber-300 drop-shadow">
            On-site Inventory Tool
          </h1>
          <p className="text-base text-slate-200/80 leading-relaxed">
            {viewMode === "fieldTech"
              ? "Field Tech view: create and receive orders while keeping quantities in sync with the floor."
              : "Shipping Clerk view: prep and dispatch orders that Field Techs will receive against inventory."}
          </p>
        </div>

        {autoOrderNotices.length > 0 && (
          <div className="p-5 bg-slate-800 border border-amber-500/40 text-amber-200 rounded-2xl shadow-lg">
            <p className="font-semibold tracking-wide">Order updates</p>
            <ul className="list-disc list-inside text-sm leading-relaxed">
              {autoOrderNotices.map((message) => (
                <li key={message}>{message}</li>
              ))}
            </ul>
          </div>
        )}

        {error && (
          <div className="p-3 rounded-md bg-rose-900/80 border border-rose-700 text-rose-100 shadow-lg">
            Error: {error}
          </div>
        )}
        {viewMode === "fieldTech" ? (
          <div className="space-y-6">
            <section className="bg-slate-800/80 backdrop-blur-sm border border-slate-700 rounded-2xl shadow-lg p-6 space-y-5">
              <div className="flex flex-col gap-2">
                <h2 className="text-xl font-semibold text-amber-300">Consume tool</h2>
              </div>
              <form onSubmit={handleConsumeSubmit} className="space-y-4">
                <div className="flex flex-col gap-3">
                  <label className="text-sm font-medium text-slate-200">
                    I am consuming
                    <div className="mt-2 flex flex-col gap-3 md:flex-row md:items-center md:gap-2">
                      <input
                        type="text"
                        inputMode="numeric"
                        value={consumeForm.qty}
                        onChange={(e) => setConsumeForm((prev) => ({ ...prev, qty: e.target.value }))}
                        placeholder="Qty"
                        className="w-full md:w-24 rounded-lg border border-slate-600 bg-slate-900 px-3 py-2 text-sm text-slate-100 focus:border-amber-400 focus:outline-none"
                      />
                      <select
                        value={consumeForm.part_number}
                        onChange={(e) => {
                          const value = e.target.value;
                          if (value === "__FULL_BOM__") {
                            setBomOpen(true);
                            return;
                          }
                          setConsumeForm((prev) => ({ ...prev, part_number: value }));
                        }}
                        className="w-full md:w-48 rounded-lg border border-slate-600 bg-slate-900 px-3 py-2 text-sm text-slate-100 focus:border-amber-400 focus:outline-none"
                      >
                        {inventory.map((item) => (
                          <option key={item.part_number} value={item.part_number}>
                            {item.part_number} - {item.description}
                          </option>
                        ))}
                        <option value="__FULL_BOM__">See full BOM</option>
                      </select>
                      <span className="text-sm font-medium text-slate-300">for</span>
                      <input
                        type="text"
                        value={consumeForm.tfiTicket}
                        onChange={(e) => setConsumeForm((prev) => ({ ...prev, tfiTicket: e.target.value }))}
                        placeholder="TFI Ticket #"
                        className="w-full md:w-48 rounded-lg border border-slate-600 bg-slate-900 px-3 py-2 text-sm text-slate-100 focus:border-amber-400 focus:outline-none"
                      />
                      <span className="text-sm font-medium text-slate-300">.</span>
                    </div>
                  </label>
                </div>
                <div className="grid gap-3 md:grid-cols-2">
                  <div className="flex flex-col gap-1">
                    <label className="text-xs font-semibold uppercase text-slate-400">Optional note</label>
                    <input
                      type="text"
                      value={consumeForm.note}
                      onChange={(e) => setConsumeForm((prev) => ({ ...prev, note: e.target.value }))}
                      placeholder="Note for the shipping clerk"
                      className="rounded-lg border border-slate-600 bg-slate-900 px-3 py-2 text-sm text-slate-100 focus:border-amber-400 focus:outline-none"
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

            <section className="bg-slate-800/80 border border-slate-700 rounded-2xl shadow-lg p-6 space-y-4">
              <div className="flex flex-col gap-1">
                <h2 className="text-xl font-semibold text-amber-300">Restock orders</h2>
                <p className="text-sm text-slate-300">
                  Create replenishment requests and receive shipments sent by the clerk.
                </p>
              </div>
              <div className="flex flex-wrap items-center gap-3">
                <div className="flex flex-col gap-2">
                  <span className="text-xs uppercase text-slate-400 font-semibold">Part number</span>
                  <div className="flex items-center gap-2">
                    <select
                      value={consumeForm.part_number}
                      onChange={(e) => setConsumeForm((prev) => ({ ...prev, part_number: e.target.value }))}
                      className="w-56 rounded-lg border border-slate-600 bg-slate-900 px-3 py-2 text-sm text-slate-100 focus:border-amber-400 focus:outline-none"
                    >
                      {inventory.map((item) => (
                        <option key={item.part_number} value={item.part_number}>
                          {item.part_number}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => handleCreateOrder(consumeForm.part_number)}
                  disabled={loading}
                  className="rounded-lg bg-amber-500 px-4 py-2 text-sm font-semibold text-slate-900 shadow-sm hover:bg-amber-400 disabled:opacity-70"
                >
                  Create order
                </button>
                <p className="text-sm text-slate-300">Creates a restock request to max for this part.</p>
              </div>

              <div className="space-y-3">
                <div className="flex items-center gap-2">
                  <h3 className="text-lg font-semibold text-slate-100">Incoming shipments</h3>
                  <span className="text-xs text-slate-400">Receive to update inventory.</span>
                </div>
                {sentRestockOrders.length === 0 ? (
                  <p className="text-sm text-slate-400">No shipments en route yet.</p>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="min-w-full text-left text-sm">
                      <thead className="bg-slate-900 text-slate-300 uppercase tracking-wide text-xs">
                        <tr>
                          <th className="p-3">Part Number</th>
                          <th className="p-3">Description</th>
                          <th className="p-3">Qty expected</th>
                          <th className="p-3">Receive</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-700">
                        {sentRestockOrders.map((order) => (
                          <tr key={`${order.part_number}-${order.id}`} className="bg-slate-900/70">
                            <td className="p-3 font-semibold text-amber-200">{order.part_number}</td>
                            <td className="p-3 text-slate-200">{order.description}</td>
                            <td className="p-3 text-slate-200">{order.requested_qty ?? "—"}</td>
                            <td className="p-3">
                              <div className="flex flex-wrap items-center gap-2">
                                <input
                                  type="text"
                                  inputMode="numeric"
                                  value={receiveInputs[order.part_number] ?? order.requested_qty ?? ""}
                                  onChange={(e) =>
                                    setReceiveInputs((prev) => ({
                                      ...prev,
                                      [order.part_number]: e.target.value,
                                    }))
                                  }
                                  className="w-28 rounded-lg border border-slate-600 bg-slate-950 px-3 py-2 text-sm text-slate-100 focus:border-amber-400 focus:outline-none"
                                />
                                <button
                                  type="button"
                                  onClick={() => handleReceive(order.part_number, order.requested_qty)}
                                  disabled={loading}
                                  className="rounded-lg bg-emerald-500 px-3 py-2 text-xs font-semibold text-white shadow-sm hover:bg-emerald-600 disabled:opacity-70"
                                >
                                  Receive
                                </button>
                              </div>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </section>

            <section className="bg-slate-800/80 backdrop-blur-sm border border-slate-700 rounded-2xl shadow-lg">
              <div className="flex items-center justify-between px-6 py-4">
                <div>
                  <h2 className="text-xl font-semibold text-amber-300">Audit tool</h2>
                  <p className="text-sm text-slate-300">Review the full inventory and request corrections.</p>
                </div>
                <button
                  type="button"
                  onClick={() => setAuditOpen((prev) => !prev)}
                  className={`rounded-lg px-4 py-2 text-sm font-semibold shadow-sm transition ${
                    auditOpen
                      ? "border border-slate-600 text-slate-100 hover:bg-slate-800 bg-slate-900"
                      : "bg-indigo-500 text-white hover:bg-indigo-600"
                  }`}
                >
                  {auditOpen ? "Hide audit tool" : "Complete audit"}
                </button>
              </div>
              {auditOpen ? (
                <div className="overflow-x-auto">
                  <table className="min-w-full text-left text-sm">
                    <thead className="bg-slate-900 text-slate-300 uppercase tracking-wide text-xs">
                      <tr>
                        <th className="p-4">Part Number</th>
                        <th className="p-4">Description</th>
                        <th className="p-4">Current Qty</th>
                        <th className="p-4">Min</th>
                        <th className="p-4">Max</th>
                        <th className="p-4">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-700">
                      {inventory.map((item) => (
                        <Fragment key={item.part_number}>
                          <tr className="bg-slate-900/70 hover:bg-slate-800 transition">
                            <td className="p-4 font-semibold text-amber-200">{item.part_number}</td>
                            <td className="p-4 text-slate-200 max-w-xs">{item.description}</td>
                            <td className="p-4 text-slate-200">{item.current_qty}</td>
                            <td className="p-4 text-slate-200">{item.min_qty}</td>
                            <td className="p-4 text-slate-200">{item.max_qty}</td>
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
                            <tr className="bg-slate-900/60">
                              <td colSpan={6} className="p-4">
                                <div className="grid gap-4 md:grid-cols-4 items-end">
                                  <div className="space-y-1">
                                    <label className="text-xs font-semibold uppercase text-slate-300">Part</label>
                                    <input
                                      type="text"
                                      value={`${item.part_number} — ${item.description}`}
                                      disabled
                                      className="w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-slate-200"
                                    />
                                  </div>
                                  <div className="space-y-1">
                                    <label className="text-xs font-semibold uppercase text-slate-300">Current quantity</label>
                                    <input
                                      type="text"
                                      value={item.current_qty}
                                      disabled
                                      className="w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-slate-200"
                                    />
                                  </div>
                                  <div className="space-y-1">
                                    <label className="text-xs font-semibold uppercase text-slate-300">Correct quantity</label>
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
                                      className="w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-slate-200 focus:border-amber-400 focus:outline-none"
                                    />
                                  </div>
                                  <div className="space-y-1 md:col-span-1">
                                    <label className="text-xs font-semibold uppercase text-slate-300">Reason</label>
                                    <textarea
                                      value={adjustmentForm.reason}
                                      onChange={(e) =>
                                        setAdjustmentForm((prev) => ({ ...prev, reason: e.target.value }))
                                      }
                                      rows={2}
                                      className="w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-slate-200 focus:border-amber-400 focus:outline-none"
                                    />
                                  </div>
                                </div>
                                <div className="mt-3 flex flex-wrap gap-3">
                                  <button
                                    type="button"
                                    onClick={() => handleRequestAdjustment(item.part_number)}
                                    disabled={loading}
                                    className="rounded-lg bg-indigo-500 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-indigo-600 disabled:opacity-70"
                                  >
                                    Submit adjustment request
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
              ) : (
                <div className="px-6 pb-6 text-sm text-slate-600">
                  Press "Complete audit" to review inventory and request corrections.
                </div>
              )}
            </section>
          </div>
        ) : (
          <div className="space-y-6">
            <div className="flex flex-wrap gap-3 items-center justify-between">
              <div className="space-y-1">
                <h2 className="text-xl font-semibold text-slate-900">Shipping Clerk tools</h2>
                <p className="text-sm text-slate-600">
                  Add parts, edit inventory directly, and handle adjustment approvals alongside shipments.
                </p>
              </div>
              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={() => setInventoryManagerOpen(true)}
                  className="rounded-lg border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-800 shadow-sm hover:bg-slate-50"
                >
                  Add Parts
                </button>
                {inventoryManagerOpen && (
                  <button
                    type="button"
                    onClick={() => setInventoryManagerOpen(false)}
                    className="rounded-lg border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-100"
                  >
                    Hide inventory editor
                  </button>
                )}
              </div>
            </div>

            {inventoryManagerOpen && (
              <section className="bg-white/95 border border-slate-200 rounded-2xl shadow-lg p-6 space-y-4">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div className="space-y-1">
                    <h3 className="text-lg font-semibold text-slate-900">Full inventory management</h3>
                    <p className="text-sm text-slate-600">
                      Edit existing records, rename parts, add new items, and adjust quantity, min, and max values.
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={addBlankInventoryRow}
                    className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-blue-700"
                  >
                    Add another part row
                  </button>
                </div>
                <div className="overflow-x-auto">
                  <table className="min-w-full text-left text-sm">
                    <thead className="bg-slate-50 text-slate-600 uppercase tracking-wide text-xs">
                      <tr>
                        <th className="p-3">Part Number</th>
                        <th className="p-3">Description</th>
                        <th className="p-3">Quantity</th>
                        <th className="p-3">Min</th>
                        <th className="p-3">Max</th>
                        <th className="p-3">Action</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {inventoryEdits.map((row, index) => (
                        <tr key={`${row.original_part_number || "new"}-${index}`} className="bg-white">
                          <td className="p-3 align-top">
                            <div className="space-y-1">
                              <input
                                type="text"
                                value={row.part_number}
                                onChange={(e) => updateInventoryEdit(index, "part_number", e.target.value)}
                                placeholder="Part #"
                                className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm focus:border-blue-400 focus:outline-none"
                              />
                              {row.original_part_number && row.original_part_number !== row.part_number && (
                                <p className="text-[11px] text-amber-600">Renaming from {row.original_part_number}</p>
                              )}
                            </div>
                          </td>
                          <td className="p-3 align-top">
                            <input
                              type="text"
                              value={row.description}
                              onChange={(e) => updateInventoryEdit(index, "description", e.target.value)}
                              placeholder="Description"
                              className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm focus:border-blue-400 focus:outline-none"
                            />
                          </td>
                          <td className="p-3 align-top">
                            <input
                              type="text"
                              inputMode="numeric"
                              value={row.current_qty}
                              onChange={(e) => updateInventoryEdit(index, "current_qty", e.target.value)}
                              placeholder="Qty"
                              className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm focus:border-blue-400 focus:outline-none"
                            />
                          </td>
                          <td className="p-3 align-top">
                            <input
                              type="text"
                              inputMode="numeric"
                              value={row.min_qty}
                              onChange={(e) => updateInventoryEdit(index, "min_qty", e.target.value)}
                              placeholder="Min"
                              className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm focus:border-blue-400 focus:outline-none"
                            />
                          </td>
                          <td className="p-3 align-top">
                            <input
                              type="text"
                              inputMode="numeric"
                              value={row.max_qty}
                              onChange={(e) => updateInventoryEdit(index, "max_qty", e.target.value)}
                              placeholder="Max"
                              className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm focus:border-blue-400 focus:outline-none"
                            />
                          </td>
                          <td className="p-3 align-top">
                            <div className="flex flex-wrap gap-2">
                              <button
                                type="button"
                                onClick={() => saveInventoryRow(index)}
                                disabled={loading}
                                className="rounded-lg bg-emerald-500 px-3 py-2 text-xs font-semibold text-white shadow-sm hover:bg-emerald-600 disabled:opacity-70"
                              >
                                Save row
                              </button>
                              {row.original_part_number && (
                                <span className="text-[11px] text-slate-500">Existing part</span>
                              )}
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </section>
            )}

            <section className="bg-slate-800/80 backdrop-blur-sm border border-slate-700 rounded-2xl shadow-lg">
              <div className="flex items-center justify-between px-6 py-4">
                <div>
                  <h2 className="text-xl font-semibold text-amber-300">Open restock orders</h2>
                  <p className="text-sm text-slate-300">Send parts for Field Techs to receive later.</p>
                </div>
              </div>
              <div className="overflow-x-auto">
                <table className="min-w-full text-left text-sm">
                  <thead className="bg-slate-900 text-slate-300 uppercase tracking-wide text-xs">
                    <tr>
                      <th className="p-4">Part Number</th>
                      <th className="p-4">Description</th>
                      <th className="p-4">Requested Qty</th>
                      <th className="p-4">Ship Qty</th>
                      <th className="p-4">Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-700">
                    {openRestockOrders.length === 0 && (
                      <tr>
                        <td colSpan={5} className="p-4 text-sm text-slate-400">
                          No open restock orders.
                        </td>
                      </tr>
                    )}
                    {openRestockOrders.map((order) => (
                      <tr key={`${order.part_number}-${order.id || order.created_at}`} className="bg-slate-900/70">
                        <td className="p-4 font-semibold text-amber-200">{order.part_number}</td>
                        <td className="p-4 text-slate-200 max-w-xs">{order.description}</td>
                        <td className="p-4 text-slate-200">{order.requested_qty ?? "—"}</td>
                        <td className="p-4">
                          <input
                            type="text"
                            inputMode="numeric"
                            value={shipmentInputs[order.part_number] || order.requested_qty || ""}
                            onChange={(e) =>
                              setShipmentInputs((prev) => ({
                                ...prev,
                                [order.part_number]: e.target.value,
                              }))
                            }
                            placeholder="Qty shipped"
                            className="w-full rounded-lg border border-slate-600 bg-slate-950 px-3 py-2 text-sm text-slate-100 focus:border-amber-400 focus:outline-none"
                          />
                        </td>
                        <td className="p-4">
                          <button
                            type="button"
                            onClick={() => completeShipment(order.part_number)}
                            disabled={loading}
                            className="rounded-lg bg-emerald-500 px-3 py-2 text-sm font-semibold text-white shadow-sm hover:bg-emerald-600 disabled:opacity-70"
                          >
                            Send order
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
                <h2 className="text-lg font-semibold text-slate-900">Approve adjustments</h2>
                <span className="text-xs text-slate-500">Review requested quantity corrections.</span>
              </div>
              {pendingAdjustments.length === 0 ? (
                <p className="text-sm text-slate-600">No adjustment requests need review.</p>
              ) : (
                <ul className="divide-y divide-slate-100">
                  {pendingAdjustments.map((request) => {
                    const currentQty = findInventoryItem(request.part_number)?.current_qty;
                    const parsedCurrent = Number(currentQty);
                    const requestedQty = Number(request.requested_qty);
                    const netChange =
                      Number.isNaN(parsedCurrent) || Number.isNaN(requestedQty)
                        ? null
                        : requestedQty - parsedCurrent;

                    return (
                      <li key={request.id} className="py-3 space-y-2">
                        <div className="flex flex-wrap items-center gap-2 text-sm font-semibold text-slate-900">
                          <span>{request.part_number}</span>
                          <span className="text-slate-500">·</span>
                          <span className="font-normal text-slate-700">{request.description}</span>
                          <span className="ml-auto rounded-full bg-indigo-50 px-2 py-1 text-[11px] uppercase tracking-wide text-indigo-700">
                            Pending
                          </span>
                        </div>
                        <div className="flex flex-wrap gap-3 text-sm text-slate-700">
                          <span>
                            Current quantity: {Number.isNaN(parsedCurrent) ? "N/A" : parsedCurrent}
                          </span>
                          <span>New quantity: {Number.isNaN(requestedQty) ? "N/A" : requestedQty}</span>
                          <span>
                            Net change: {netChange === null ? "N/A" : `${netChange > 0 ? "+" : ""}${netChange}`}
                          </span>
                          {request.note && <span className="text-slate-500">{request.note}</span>}
                        </div>
                        <div className="flex flex-wrap gap-2">
                          <button
                            type="button"
                            onClick={() => handleApproveAdjustment(request.id)}
                            disabled={loading}
                            className="rounded-lg bg-blue-600 px-3 py-2 text-xs font-semibold text-white shadow-sm hover:bg-blue-700 disabled:opacity-70"
                          >
                            Approve and update inventory
                          </button>
                          <button
                            type="button"
                            onClick={() => handleDenyAdjustment(request.id)}
                            disabled={loading}
                            className="rounded-lg border border-slate-200 px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-100 disabled:opacity-70"
                          >
                            Deny request
                          </button>
                        </div>
                      </li>
                    );
                  })}
                </ul>
              )}
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
                  {orderQueue.map((request) => {
                    const currentQty = findInventoryItem(request.part_number)?.current_qty;
                    const parsedCurrent = Number(currentQty);
                    const requestedQty = Number(request.requested_qty);
                    const netChange =
                      Number.isNaN(parsedCurrent) || Number.isNaN(requestedQty)
                        ? null
                        : requestedQty - parsedCurrent;

                    return (
                      <li
                        key={`${request.part_number}-${request.id || request.created_at}`}
                        className="py-3 flex flex-col gap-2"
                      >
                        <div className="flex items-center gap-2 text-sm font-semibold text-slate-900">
                          <span>{request.part_number}</span>
                          <span className="text-slate-500">·</span>
                          <span className="font-normal text-slate-700">{request.description}</span>
                          <span className="ml-auto text-xs uppercase tracking-wide rounded-full px-2 py-1 bg-slate-100 text-slate-600">
                            {request.request_type === "adjustment" ? "Adjustment" : "Restock"} · {request.status}
                          </span>
                        </div>
                        {request.request_type === "adjustment" && (
                          <div className="flex flex-wrap gap-3 text-sm text-slate-700">
                            <span>
                              Current quantity: {Number.isNaN(parsedCurrent) ? "N/A" : parsedCurrent}
                            </span>
                            <span>New quantity: {Number.isNaN(requestedQty) ? "N/A" : requestedQty}</span>
                            <span>
                              Net change: {netChange === null ? "N/A" : `${netChange > 0 ? "+" : ""}${netChange}`}
                            </span>
                          </div>
                        )}
                        {request.note && <p className="text-sm text-slate-700">{request.note}</p>}
                      </li>
                    );
                  })}
                </ul>
              )}
            </section>
          </div>
        )}
      </div>
      {bomOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 px-4 py-10">
          <div className="w-full max-w-4xl rounded-2xl border border-amber-500/40 bg-slate-900 shadow-2xl">
            <div className="flex items-center justify-between border-b border-slate-700 px-6 py-4">
              <div>
                <h2 className="text-xl font-semibold text-amber-300">Bill of Materials</h2>
                <p className="text-sm text-slate-300">Review all parts, including zero-quantity placeholders.</p>
              </div>
              <button
                type="button"
                onClick={() => setBomOpen(false)}
                className="rounded-lg border border-slate-600 px-3 py-1 text-sm font-semibold text-slate-100 hover:bg-slate-800"
              >
                Close
              </button>
            </div>
            <div className="max-h-[60vh] overflow-y-auto">
              <table className="min-w-full text-left text-sm">
                <thead className="bg-slate-800 text-slate-300 uppercase tracking-wide text-xs">
                  <tr>
                    <th className="p-3">Part Number</th>
                    <th className="p-3">Description</th>
                    <th className="p-3">Qty</th>
                    <th className="p-3">Min</th>
                    <th className="p-3">Max</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-700">
                  {inventory.map((item) => (
                    <tr key={item.part_number} className="bg-slate-900/60">
                      <td className="p-3 font-semibold text-amber-200">{item.part_number}</td>
                      <td className="p-3 text-slate-200">{item.description}</td>
                      <td className="p-3 text-slate-200">{item.current_qty}</td>
                      <td className="p-3 text-slate-200">{item.min_qty}</td>
                      <td className="p-3 text-slate-200">{item.max_qty}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="flex items-center justify-between gap-3 border-t border-slate-700 px-6 py-4">
              <p className="text-sm text-slate-300">
                Need a placeholder? Add a part with quantity 0 in the inventory editor to pad the BOM.
              </p>
              <button
                type="button"
                onClick={() => {
                  setInventoryManagerOpen(true);
                  addBlankInventoryRow();
                  setBomOpen(false);
                }}
                className="rounded-lg bg-amber-500 px-4 py-2 text-sm font-semibold text-slate-900 shadow-sm hover:bg-amber-400"
              >
                Add 0-qty part
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default ExampleWMS;
