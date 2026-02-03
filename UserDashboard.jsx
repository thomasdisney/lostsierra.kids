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

  // Form states
  const [consumeForm, setConsumeForm] = useState({
    part_number: "",
    qty: "",
    tfiTicket: "",
  });

  const [adjustmentForm, setAdjustmentForm] = useState({
    part_number: "",
    requested_qty: "",
    reason: "",
  });

  useEffect(() => {
    fetchData();
  }, [selectedLocation]);

  async function fetchData() {
    try {
      setLoading(true);
      const headers = { Authorization: `Bearer ${token}` };

      const response = await fetch("/api/inventory", { headers });
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

  async function handleConsume(e) {
    e.preventDefault();
    try {
      const response = await fetch("/api/inventory", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          action: "consume",
          part_number: consumeForm.part_number,
          qty: parseInt(consumeForm.qty),
          tfiTicket: consumeForm.tfiTicket,
        }),
      });

      if (response.ok) {
        setSuccess("Part consumed successfully!");
        setConsumeForm({ part_number: "", qty: "", tfiTicket: "" });
        await fetchData();
        setTimeout(() => setSuccess(""), 3000);
      } else {
        const data = await response.json();
        setError(data.error || "Failed to consume part");
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
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          action: "request_adjustment",
          part_number: adjustmentForm.part_number,
          requested_qty: parseInt(adjustmentForm.requested_qty),
          reason: adjustmentForm.reason,
        }),
      });

      if (response.ok) {
        setSuccess("Adjustment request submitted!");
        setAdjustmentForm({ part_number: "", requested_qty: "", reason: "" });
        await fetchData();
        setTimeout(() => setSuccess(""), 3000);
      } else {
        const data = await response.json();
        setError(data.error || "Failed to submit adjustment");
      }
    } catch (err) {
      setError("Error: " + err.message);
    }
  }

  function handleLogout() {
    logout();
    navigate("/login");
  }

  return (
    <div className="min-h-screen bg-slate-50">
      {/* Header */}
      <div className="bg-white border-b border-slate-200">
        <div className="max-w-7xl mx-auto px-4 py-4 flex justify-between items-center">
          <div>
            <h1 className="text-2xl font-bold text-slate-900">WMS - Inventory</h1>
            <p className="text-slate-600 text-sm">Hello, {user?.name}</p>
          </div>
          <button
            onClick={handleLogout}
            className="px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700"
          >
            Logout
          </button>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 py-8">
        {/* Alerts */}
        {error && (
          <div className="mb-4 p-4 bg-red-50 border border-red-200 text-red-700 rounded">
            {error}
            <button onClick={() => setError("")} className="ml-4 underline">
              Dismiss
            </button>
          </div>
        )}

        {success && (
          <div className="mb-4 p-4 bg-green-50 border border-green-200 text-green-700 rounded">
            {success}
          </div>
        )}

        {/* Location Selector */}
        {locations.length > 0 && (
          <div className="mb-6">
            <label className="block text-sm font-medium text-slate-700 mb-2">
              Select Location
            </label>
            <select
              value={selectedLocation || ""}
              onChange={(e) => setSelectedLocation(parseInt(e.target.value))}
              className="px-4 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              {locations.map((loc) => (
                <option key={loc.id} value={loc.id}>
                  {loc.name} ({loc.warehouse_code})
                </option>
              ))}
            </select>
          </div>
        )}

        {/* Tabs */}
        <div className="flex space-x-4 mb-6 border-b border-slate-200">
          {["consume", "adjust", "inventory"].map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`px-4 py-2 font-medium capitalize border-b-2 transition ${
                activeTab === tab
                  ? "border-blue-600 text-blue-600"
                  : "border-transparent text-slate-600 hover:text-slate-900"
              }`}
            >
              {tab === "consume" && "Consume Part"}
              {tab === "adjust" && "Request Adjustment"}
              {tab === "inventory" && "View Inventory"}
            </button>
          ))}
        </div>

        {loading ? (
          <div className="text-center py-8">Loading...</div>
        ) : (
          <>
            {/* Consume Tab */}
            {activeTab === "consume" && (
              <div className="max-w-2xl">
                <h2 className="text-xl font-bold mb-4">Consume Part from Inventory</h2>
                <form
                  onSubmit={handleConsume}
                  className="bg-white p-6 rounded-lg border border-slate-200"
                >
                  <div className="space-y-4">
                    <div>
                      <label className="block text-sm font-medium text-slate-700 mb-1">
                        Part Number *
                      </label>
                      <select
                        value={consumeForm.part_number}
                        onChange={(e) =>
                          setConsumeForm({
                            ...consumeForm,
                            part_number: e.target.value,
                          })
                        }
                        required
                        className="w-full px-3 py-2 border border-slate-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
                      >
                        <option value="">Select a part...</option>
                        {filteredInventory.map((item) => (
                          <option key={item.part_number} value={item.part_number}>
                            {item.part_number} - {item.description} (Stock: {item.current_qty})
                          </option>
                        ))}
                      </select>
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-slate-700 mb-1">
                        Quantity to Consume *
                      </label>
                      <input
                        type="number"
                        min="1"
                        value={consumeForm.qty}
                        onChange={(e) =>
                          setConsumeForm({ ...consumeForm, qty: e.target.value })
                        }
                        required
                        className="w-full px-3 py-2 border border-slate-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
                        placeholder="0"
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-slate-700 mb-1">
                        TFI Ticket # *
                      </label>
                      <input
                        type="text"
                        value={consumeForm.tfiTicket}
                        onChange={(e) =>
                          setConsumeForm({
                            ...consumeForm,
                            tfiTicket: e.target.value,
                          })
                        }
                        required
                        className="w-full px-3 py-2 border border-slate-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
                        placeholder="TFI-2024-001"
                      />
                    </div>
                  </div>

                  <button
                    type="submit"
                    className="mt-6 w-full px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 font-medium"
                  >
                    Consume Part
                  </button>
                </form>
              </div>
            )}

            {/* Adjustment Tab */}
            {activeTab === "adjust" && (
              <div className="max-w-2xl">
                <h2 className="text-xl font-bold mb-4">Request Quantity Adjustment</h2>
                <form
                  onSubmit={handleRequestAdjustment}
                  className="bg-white p-6 rounded-lg border border-slate-200"
                >
                  <div className="space-y-4">
                    <div>
                      <label className="block text-sm font-medium text-slate-700 mb-1">
                        Part Number *
                      </label>
                      <select
                        value={adjustmentForm.part_number}
                        onChange={(e) =>
                          setAdjustmentForm({
                            ...adjustmentForm,
                            part_number: e.target.value,
                          })
                        }
                        required
                        className="w-full px-3 py-2 border border-slate-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
                      >
                        <option value="">Select a part...</option>
                        {filteredInventory.map((item) => (
                          <option key={item.part_number} value={item.part_number}>
                            {item.part_number} - {item.description} (Current: {item.current_qty})
                          </option>
                        ))}
                      </select>
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-slate-700 mb-1">
                        Correct Quantity *
                      </label>
                      <input
                        type="number"
                        min="0"
                        value={adjustmentForm.requested_qty}
                        onChange={(e) =>
                          setAdjustmentForm({
                            ...adjustmentForm,
                            requested_qty: e.target.value,
                          })
                        }
                        required
                        className="w-full px-3 py-2 border border-slate-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
                        placeholder="0"
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-slate-700 mb-1">
                        Reason for Adjustment *
                      </label>
                      <textarea
                        value={adjustmentForm.reason}
                        onChange={(e) =>
                          setAdjustmentForm({
                            ...adjustmentForm,
                            reason: e.target.value,
                          })
                        }
                        required
                        rows="4"
                        className="w-full px-3 py-2 border border-slate-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
                        placeholder="Explain why this adjustment is needed..."
                      />
                    </div>
                  </div>

                  <button
                    type="submit"
                    className="mt-6 w-full px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 font-medium"
                  >
                    Submit Request
                  </button>
                </form>
              </div>
            )}

            {/* Inventory Tab */}
            {activeTab === "inventory" && (
              <div>
                <h2 className="text-xl font-bold mb-4">Current Inventory</h2>
                {filteredInventory.length === 0 ? (
                  <div className="bg-white p-6 rounded-lg border border-slate-200 text-center text-slate-600">
                    No inventory items for this location
                  </div>
                ) : (
                  <div className="bg-white rounded-lg border border-slate-200">
                    <table className="w-full text-sm">
                      <thead className="border-b border-slate-200 bg-slate-50">
                        <tr>
                          <th className="px-6 py-3 text-left font-medium text-slate-600">
                            Part Number
                          </th>
                          <th className="px-6 py-3 text-left font-medium text-slate-600">
                            Description
                          </th>
                          <th className="px-6 py-3 text-center font-medium text-slate-600">
                            Current
                          </th>
                          <th className="px-6 py-3 text-center font-medium text-slate-600">
                            Min
                          </th>
                          <th className="px-6 py-3 text-center font-medium text-slate-600">
                            Max
                          </th>
                          <th className="px-6 py-3 text-center font-medium text-slate-600">
                            Status
                          </th>
                        </tr>
                      </thead>
                      <tbody>
                        {filteredInventory.map((item) => {
                          const isLow = item.current_qty <= item.min_qty;
                          return (
                            <tr
                              key={item.part_number}
                              className={`border-b border-slate-200 hover:bg-slate-50 ${
                                isLow ? "bg-red-50" : ""
                              }`}
                            >
                              <td className="px-6 py-3 font-medium">{item.part_number}</td>
                              <td className="px-6 py-3">{item.description}</td>
                              <td className="px-6 py-3 text-center">{item.current_qty}</td>
                              <td className="px-6 py-3 text-center">{item.min_qty}</td>
                              <td className="px-6 py-3 text-center">{item.max_qty}</td>
                              <td className="px-6 py-3 text-center">
                                {isLow ? (
                                  <span className="px-2 py-1 bg-red-100 text-red-700 rounded text-xs font-medium">
                                    Low Stock
                                  </span>
                                ) : (
                                  <span className="px-2 py-1 bg-green-100 text-green-700 rounded text-xs font-medium">
                                    OK
                                  </span>
                                )}
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
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
