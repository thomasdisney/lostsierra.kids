import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "./AuthContext";

function UserDashboard() {
  const { user, logout, token } = useAuth();
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState("consume");
  const [inventory, setInventory] = useState([]);
  const [locations, setLocations] = useState([]);
  const [selectedLocation, setSelectedLocation] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const [consumeForm, setConsumeForm] = useState({ part_number: "", qty: "", tfiTicket: "" });
  const [adjustmentForm, setAdjustmentForm] = useState({ part_number: "", requested_qty: "", reason: "" });

  useEffect(() => { fetchData(); }, [selectedLocation]);

  async function fetchData() {
    try {
      setLoading(true);
      const response = await fetch("/api/inventory", {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (response.ok) {
        const data = await response.json();
        setInventory(data.inventory);
        setLocations(data.locations || []);
        if (data.locations?.length > 0 && !selectedLocation) {
          setSelectedLocation(data.locations[0].id);
        }
      }
      setError("");
    } catch (err) {
      setError("Failed to fetch data: " + err.message);
    } finally {
      setLoading(false);
    }
  }

  const filteredInventory = selectedLocation
    ? inventory.filter((item) => item.location_id === selectedLocation)
    : [];

  const currentLocation = locations.find(l => l.id === selectedLocation);

  async function handleConsume(e) {
    e.preventDefault();
    try {
      const response = await fetch("/api/inventory", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          action: "consume",
          part_number: consumeForm.part_number,
          qty: parseInt(consumeForm.qty),
          tfiTicket: consumeForm.tfiTicket,
          location_id: selectedLocation,
        }),
      });

      if (response.ok) {
        setSuccess("Part consumed successfully!");
        setConsumeForm({ part_number: "", qty: "", tfiTicket: "" });
        await fetchData();
        setTimeout(() => setSuccess(""), 4000);
      } else {
        setError((await response.json()).error || "Failed to consume part");
      }
    } catch (err) {
      setError("Error: " + err.message);
    }
  }

  async function handleRequestAdjustment(e) {
    e.preventDefault();
    try {
      const response = await fetch("/api/inventory", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          action: "request_adjustment",
          part_number: adjustmentForm.part_number,
          requested_qty: parseInt(adjustmentForm.requested_qty),
          reason: adjustmentForm.reason,
          location_id: selectedLocation,
        }),
      });

      if (response.ok) {
        setSuccess("Adjustment request submitted for review!");
        setAdjustmentForm({ part_number: "", requested_qty: "", reason: "" });
        await fetchData();
        setTimeout(() => setSuccess(""), 4000);
      } else {
        setError((await response.json()).error || "Failed to submit adjustment");
      }
    } catch (err) {
      setError("Error: " + err.message);
    }
  }

  function handleLogout() {
    logout();
    navigate("/login");
  }

  const selectedPart = filteredInventory.find(i => i.part_number === consumeForm.part_number);
  const selectedAdjustPart = filteredInventory.find(i => i.part_number === adjustmentForm.part_number);

  return (
    <div className="min-h-screen wms-grid-bg">
      {/* Header */}
      <header className="sticky top-0 z-10 bg-slate-900/90 backdrop-blur-sm border-b border-slate-700/50">
        <div className="max-w-6xl mx-auto px-6 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-cyan-500 to-cyan-600 flex items-center justify-center wms-glow">
                <svg className="w-5 h-5 text-slate-900" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
                </svg>
              </div>
              <div>
                <h1 className="text-lg font-bold text-white">WMS<span className="text-cyan-400">.</span></h1>
                <p className="text-xs text-slate-500">Field Operations</p>
              </div>
            </div>

            <div className="flex items-center gap-4">
              <div className="flex items-center gap-2 text-xs font-mono text-slate-500">
                <div className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse-glow"></div>
                <span>ONLINE</span>
              </div>
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-full bg-gradient-to-br from-cyan-500 to-cyan-600 flex items-center justify-center text-xs font-bold text-white">
                  {user?.name?.charAt(0) || "U"}
                </div>
                <button
                  onClick={handleLogout}
                  className="text-slate-400 hover:text-red-400 transition"
                  title="Sign out"
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
                  </svg>
                </button>
              </div>
            </div>
          </div>
        </div>
      </header>

      <div className="max-w-6xl mx-auto px-6 py-8">
        {/* Alerts */}
        {error && (
          <div className="mb-6 p-4 bg-red-500/10 border border-red-500/30 rounded-lg flex items-center gap-3 animate-slide-up">
            <svg className="w-5 h-5 text-red-400 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <span className="text-red-400 text-sm flex-1">{error}</span>
            <button onClick={() => setError("")} className="text-red-400/50 hover:text-red-400">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        )}

        {success && (
          <div className="mb-6 p-4 bg-emerald-500/10 border border-emerald-500/30 rounded-lg flex items-center gap-3 animate-slide-up">
            <svg className="w-5 h-5 text-emerald-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <span className="text-emerald-400 text-sm">{success}</span>
          </div>
        )}

        {/* Location Selector */}
        {locations.length > 0 && (
          <div className="mb-8">
            <div className="wms-card p-4 flex items-center justify-between">
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 rounded-lg bg-gradient-to-br from-cyan-500/20 to-cyan-600/20 flex items-center justify-center">
                  <svg className="w-6 h-6 text-cyan-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                  </svg>
                </div>
                <div>
                  <p className="text-xs text-slate-500 uppercase tracking-wider mb-1">Current Location</p>
                  <div className="flex items-center gap-2">
                    <select
                      value={selectedLocation || ""}
                      onChange={(e) => setSelectedLocation(parseInt(e.target.value))}
                      className="wms-input px-4 py-2 rounded-lg text-white font-medium pr-10 appearance-none bg-[url('data:image/svg+xml;charset=US-ASCII,%3Csvg%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%20width%3D%2224%22%20height%3D%2224%22%20viewBox%3D%220%200%2024%2024%22%20fill%3D%22none%22%20stroke%3D%22%2394a3b8%22%20stroke-width%3D%222%22%3E%3Cpath%20d%3D%22M6%209l6%206%206-6%22%2F%3E%3C%2Fsvg%3E')] bg-no-repeat bg-[right_0.5rem_center] bg-[length:1.5rem]"
                    >
                      {locations.map((loc) => (
                        <option key={loc.id} value={loc.id}>
                          {loc.name}
                        </option>
                      ))}
                    </select>
                    {currentLocation && (
                      <span className="px-3 py-1.5 text-xs font-mono bg-cyan-500/20 text-cyan-400 rounded-lg">
                        {currentLocation.warehouse_code}
                      </span>
                    )}
                  </div>
                </div>
              </div>
              <div className="text-right">
                <p className="text-2xl font-bold font-mono text-white">{filteredInventory.length}</p>
                <p className="text-xs text-slate-500">Items in stock</p>
              </div>
            </div>
          </div>
        )}

        {/* Tabs */}
        <div className="flex gap-2 mb-8">
          {[
            { id: "consume", label: "Consume Part", icon: "M15 12H9m12 0a9 9 0 11-18 0 9 9 0 0118 0z" },
            { id: "adjust", label: "Request Adjustment", icon: "M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" },
            { id: "inventory", label: "View Inventory", icon: "M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" },
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex items-center gap-2 px-5 py-3 rounded-lg text-sm font-medium transition ${
                activeTab === tab.id
                  ? "bg-cyan-500/20 text-cyan-400 border border-cyan-500/30"
                  : "text-slate-400 hover:text-white hover:bg-slate-800/50"
              }`}
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d={tab.icon} />
              </svg>
              <span>{tab.label}</span>
            </button>
          ))}
        </div>

        {loading ? (
          <div className="flex items-center justify-center h-64">
            <div className="flex items-center gap-3 text-slate-400">
              <svg className="animate-spin w-6 h-6" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"></path>
              </svg>
              <span className="text-sm font-mono">Loading inventory...</span>
            </div>
          </div>
        ) : (
          <>
            {/* Consume Tab */}
            {activeTab === "consume" && (
              <div className="animate-slide-up grid grid-cols-1 lg:grid-cols-2 gap-6">
                <div className="wms-card p-6">
                  <h3 className="text-lg font-semibold text-white mb-1">Consume Part</h3>
                  <p className="text-sm text-slate-500 mb-6">Record part usage from inventory</p>

                  <form onSubmit={handleConsume} className="space-y-5">
                    <div>
                      <label className="block text-xs text-slate-500 uppercase tracking-wider mb-2">
                        Select Part *
                      </label>
                      <select
                        value={consumeForm.part_number}
                        onChange={(e) => setConsumeForm({ ...consumeForm, part_number: e.target.value })}
                        required
                        className="wms-input w-full px-4 py-3 rounded-lg text-sm"
                      >
                        <option value="">Choose a part...</option>
                        {filteredInventory.map((item) => (
                          <option key={item.part_number} value={item.part_number}>
                            {item.part_number} — {item.description}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div>
                      <label className="block text-xs text-slate-500 uppercase tracking-wider mb-2">
                        Quantity *
                      </label>
                      <input
                        type="number"
                        min="1"
                        max={selectedPart?.current_qty || 999}
                        value={consumeForm.qty}
                        onChange={(e) => setConsumeForm({ ...consumeForm, qty: e.target.value })}
                        required
                        className="wms-input w-full px-4 py-3 rounded-lg text-sm font-mono"
                        placeholder="0"
                      />
                      {selectedPart && (
                        <p className="text-xs text-slate-500 mt-1">
                          Available: <span className="text-cyan-400 font-mono">{selectedPart.current_qty}</span> units
                        </p>
                      )}
                    </div>

                    <div>
                      <label className="block text-xs text-slate-500 uppercase tracking-wider mb-2">
                        TFI Ticket # *
                      </label>
                      <input
                        type="text"
                        value={consumeForm.tfiTicket}
                        onChange={(e) => setConsumeForm({ ...consumeForm, tfiTicket: e.target.value })}
                        required
                        className="wms-input w-full px-4 py-3 rounded-lg text-sm font-mono"
                        placeholder="TFI-2024-001"
                      />
                    </div>

                    <button
                      type="submit"
                      disabled={!consumeForm.part_number || !consumeForm.qty || !consumeForm.tfiTicket}
                      className="wms-btn-primary w-full py-3 rounded-lg flex items-center justify-center gap-2"
                    >
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12H9m12 0a9 9 0 11-18 0 9 9 0 0118 0z" />
                      </svg>
                      <span>Consume Part</span>
                    </button>
                  </form>
                </div>

                {/* Selected Part Preview */}
                <div>
                  {selectedPart ? (
                    <div className="wms-card p-6 animate-slide-up">
                      <div className="flex items-center gap-3 mb-4">
                        <div className="w-12 h-12 rounded-lg bg-gradient-to-br from-cyan-500/20 to-cyan-600/20 flex items-center justify-center">
                          <svg className="w-6 h-6 text-cyan-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
                          </svg>
                        </div>
                        <div>
                          <p className="font-mono text-lg text-white font-bold">{selectedPart.part_number}</p>
                          <p className="text-sm text-slate-400">{selectedPart.description}</p>
                        </div>
                      </div>

                      <div className="space-y-4">
                        <div>
                          <div className="flex items-center justify-between mb-2">
                            <span className="text-xs text-slate-500 uppercase">Stock Level</span>
                            <span className="font-mono text-sm text-white">
                              {selectedPart.current_qty} / {selectedPart.max_qty}
                            </span>
                          </div>
                          <div className="stock-bar h-3 rounded">
                            <div
                              className={`stock-bar-fill rounded ${
                                selectedPart.current_qty <= selectedPart.min_qty
                                  ? "bg-red-500"
                                  : selectedPart.current_qty < selectedPart.max_qty * 0.5
                                  ? "bg-amber-500"
                                  : "bg-emerald-500"
                              }`}
                              style={{ width: `${Math.min(100, (selectedPart.current_qty / selectedPart.max_qty) * 100)}%` }}
                            ></div>
                          </div>
                        </div>

                        <div className="grid grid-cols-3 gap-4 pt-4 border-t border-slate-700/50">
                          <div className="text-center">
                            <p className="text-2xl font-bold font-mono text-white">{selectedPart.current_qty}</p>
                            <p className="text-xs text-slate-500">Current</p>
                          </div>
                          <div className="text-center">
                            <p className="text-2xl font-bold font-mono text-amber-400">{selectedPart.min_qty}</p>
                            <p className="text-xs text-slate-500">Min</p>
                          </div>
                          <div className="text-center">
                            <p className="text-2xl font-bold font-mono text-emerald-400">{selectedPart.max_qty}</p>
                            <p className="text-xs text-slate-500">Max</p>
                          </div>
                        </div>

                        {selectedPart.current_qty <= selectedPart.min_qty && (
                          <div className="flex items-center gap-2 p-3 bg-red-500/10 border border-red-500/30 rounded-lg">
                            <svg className="w-5 h-5 text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                            </svg>
                            <span className="text-sm text-red-400">Low stock — reorder triggered</span>
                          </div>
                        )}
                      </div>
                    </div>
                  ) : (
                    <div className="wms-card p-12 text-center">
                      <svg className="w-16 h-16 text-slate-700 mx-auto mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
                      </svg>
                      <p className="text-slate-500">Select a part to view details</p>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Adjustment Tab */}
            {activeTab === "adjust" && (
              <div className="animate-slide-up max-w-2xl">
                <div className="wms-card p-6">
                  <h3 className="text-lg font-semibold text-white mb-1">Request Quantity Adjustment</h3>
                  <p className="text-sm text-slate-500 mb-6">Submit a correction request for admin approval</p>

                  <form onSubmit={handleRequestAdjustment} className="space-y-5">
                    <div>
                      <label className="block text-xs text-slate-500 uppercase tracking-wider mb-2">
                        Select Part *
                      </label>
                      <select
                        value={adjustmentForm.part_number}
                        onChange={(e) => setAdjustmentForm({ ...adjustmentForm, part_number: e.target.value })}
                        required
                        className="wms-input w-full px-4 py-3 rounded-lg text-sm"
                      >
                        <option value="">Choose a part...</option>
                        {filteredInventory.map((item) => (
                          <option key={item.part_number} value={item.part_number}>
                            {item.part_number} — {item.description} (Current: {item.current_qty})
                          </option>
                        ))}
                      </select>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="block text-xs text-slate-500 uppercase tracking-wider mb-2">
                          Current Quantity
                        </label>
                        <div className="wms-input px-4 py-3 rounded-lg bg-slate-800/50">
                          <span className="font-mono text-slate-400">
                            {selectedAdjustPart?.current_qty ?? "—"}
                          </span>
                        </div>
                      </div>
                      <div>
                        <label className="block text-xs text-slate-500 uppercase tracking-wider mb-2">
                          Correct Quantity *
                        </label>
                        <input
                          type="number"
                          min="0"
                          value={adjustmentForm.requested_qty}
                          onChange={(e) => setAdjustmentForm({ ...adjustmentForm, requested_qty: e.target.value })}
                          required
                          className="wms-input w-full px-4 py-3 rounded-lg text-sm font-mono"
                          placeholder="0"
                        />
                      </div>
                    </div>

                    <div>
                      <label className="block text-xs text-slate-500 uppercase tracking-wider mb-2">
                        Reason for Adjustment *
                      </label>
                      <textarea
                        value={adjustmentForm.reason}
                        onChange={(e) => setAdjustmentForm({ ...adjustmentForm, reason: e.target.value })}
                        required
                        rows="4"
                        className="wms-input w-full px-4 py-3 rounded-lg text-sm resize-none"
                        placeholder="Explain why this adjustment is needed (e.g., physical count discrepancy, damaged goods, etc.)"
                      />
                    </div>

                    <button
                      type="submit"
                      disabled={!adjustmentForm.part_number || adjustmentForm.requested_qty === "" || !adjustmentForm.reason}
                      className="wms-btn-primary w-full py-3 rounded-lg flex items-center justify-center gap-2"
                    >
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                      </svg>
                      <span>Submit Request</span>
                    </button>
                  </form>
                </div>
              </div>
            )}

            {/* Inventory Tab */}
            {activeTab === "inventory" && (
              <div className="animate-slide-up">
                <div className="mb-6">
                  <h3 className="text-lg font-semibold text-white">Inventory at {currentLocation?.name}</h3>
                  <p className="text-sm text-slate-500">{filteredInventory.length} items</p>
                </div>

                {filteredInventory.length === 0 ? (
                  <div className="wms-card p-12 text-center">
                    <svg className="w-16 h-16 text-slate-700 mx-auto mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
                    </svg>
                    <p className="text-slate-400 mb-2">No inventory items</p>
                    <p className="text-sm text-slate-500">This location has no items in stock</p>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {filteredInventory.map((item) => {
                      const isLow = item.current_qty <= item.min_qty;
                      const percentage = Math.min(100, (item.current_qty / item.max_qty) * 100);
                      return (
                        <div
                          key={item.part_number}
                          className={`wms-card p-5 hover:border-cyan-500/30 transition ${
                            isLow ? "border-red-500/30" : ""
                          }`}
                        >
                          <div className="flex items-start justify-between mb-3">
                            <div>
                              <p className="font-mono text-white font-bold">{item.part_number}</p>
                              <p className="text-sm text-slate-400">{item.description}</p>
                            </div>
                            <span className={`wms-badge ${
                              isLow
                                ? "bg-red-500/20 text-red-400"
                                : "bg-emerald-500/20 text-emerald-400"
                            }`}>
                              {isLow ? "LOW" : "OK"}
                            </span>
                          </div>

                          <div className="mb-3">
                            <div className="stock-bar h-2 rounded">
                              <div
                                className={`stock-bar-fill rounded ${
                                  isLow ? "bg-red-500" : percentage < 50 ? "bg-amber-500" : "bg-emerald-500"
                                }`}
                                style={{ width: `${percentage}%` }}
                              ></div>
                            </div>
                          </div>

                          <div className="flex items-center justify-between text-xs">
                            <span className="text-slate-500">Stock</span>
                            <span className="font-mono text-white">
                              {item.current_qty} / {item.max_qty}
                            </span>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}

export default UserDashboard;
