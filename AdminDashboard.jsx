import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "./AuthContext";

function AdminDashboard() {
  const { user, logout, token } = useAuth();
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState("accounts");
  const [users, setUsers] = useState([]);
  const [locations, setLocations] = useState([]);
  const [inventory, setInventory] = useState([]);
  const [orderQueue, setOrderQueue] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  // Form states
  const [showUserForm, setShowUserForm] = useState(false);
  const [showLocationForm, setShowLocationForm] = useState(false);
  const [userForm, setUserForm] = useState({
    email: "",
    password: "",
    name: "",
    role: "user",
    locationIds: [],
  });
  const [locationForm, setLocationForm] = useState({
    name: "",
    warehouseCode: "",
  });

  useEffect(() => {
    fetchData();
  }, [activeTab]);

  async function fetchData() {
    try {
      setLoading(true);
      const headers = { Authorization: `Bearer ${token}` };

      // Fetch users
      const usersRes = await fetch("/api/admin/users", { headers });
      if (usersRes.ok) {
        const data = await usersRes.json();
        setUsers(data.users);
      }

      // Fetch locations
      const locsRes = await fetch("/api/admin/locations", { headers });
      if (locsRes.ok) {
        const data = await locsRes.json();
        setLocations(data.locations);
      }

      // Fetch inventory and orders
      const invRes = await fetch("/api/inventory", { headers });
      if (invRes.ok) {
        const data = await invRes.json();
        setInventory(data.inventory);
        setOrderQueue(data.orderQueue);
      }

      setError("");
    } catch (err) {
      setError("Failed to fetch data: " + err.message);
    } finally {
      setLoading(false);
    }
  }

  async function handleCreateUser(e) {
    e.preventDefault();
    try {
      const response = await fetch("/api/admin/users", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(userForm),
      });

      if (response.ok) {
        setUserForm({ email: "", password: "", name: "", role: "user", locationIds: [] });
        setShowUserForm(false);
        await fetchData();
      } else {
        const data = await response.json();
        setError(data.error || "Failed to create user");
      }
    } catch (err) {
      setError("Error: " + err.message);
    }
  }

  async function handleCreateLocation(e) {
    e.preventDefault();
    try {
      const response = await fetch("/api/admin/locations", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(locationForm),
      });

      if (response.ok) {
        setLocationForm({ name: "", warehouseCode: "" });
        setShowLocationForm(false);
        await fetchData();
      } else {
        const data = await response.json();
        setError(data.error || "Failed to create location");
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
          <h1 className="text-2xl font-bold text-slate-900">WMS Admin</h1>
          <button
            onClick={handleLogout}
            className="px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700"
          >
            Logout
          </button>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 py-8">
        {error && (
          <div className="mb-4 p-4 bg-red-50 border border-red-200 text-red-700 rounded">
            {error}
            <button
              onClick={() => setError("")}
              className="ml-4 underline"
            >
              Dismiss
            </button>
          </div>
        )}

        {/* Tabs */}
        <div className="flex space-x-4 mb-6 border-b border-slate-200">
          {["accounts", "locations", "requests", "inventory"].map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`px-4 py-2 font-medium capitalize border-b-2 transition ${
                activeTab === tab
                  ? "border-blue-600 text-blue-600"
                  : "border-transparent text-slate-600 hover:text-slate-900"
              }`}
            >
              {tab}
            </button>
          ))}
        </div>

        {loading ? (
          <div className="text-center py-8">Loading...</div>
        ) : (
          <>
            {/* Accounts Tab */}
            {activeTab === "accounts" && (
              <div>
                <div className="flex justify-between items-center mb-4">
                  <h2 className="text-xl font-bold">User Accounts</h2>
                  <button
                    onClick={() => setShowUserForm(!showUserForm)}
                    className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
                  >
                    {showUserForm ? "Cancel" : "+ New User"}
                  </button>
                </div>

                {showUserForm && (
                  <form onSubmit={handleCreateUser} className="bg-white p-6 rounded-lg mb-6 border border-slate-200">
                    <div className="grid grid-cols-2 gap-4">
                      <input
                        type="email"
                        placeholder="Email"
                        value={userForm.email}
                        onChange={(e) =>
                          setUserForm({ ...userForm, email: e.target.value })
                        }
                        required
                        className="px-3 py-2 border border-slate-300 rounded"
                      />
                      <input
                        type="password"
                        placeholder="Password"
                        value={userForm.password}
                        onChange={(e) =>
                          setUserForm({ ...userForm, password: e.target.value })
                        }
                        required
                        className="px-3 py-2 border border-slate-300 rounded"
                      />
                      <input
                        type="text"
                        placeholder="Name"
                        value={userForm.name}
                        onChange={(e) =>
                          setUserForm({ ...userForm, name: e.target.value })
                        }
                        required
                        className="px-3 py-2 border border-slate-300 rounded"
                      />
                      <select
                        value={userForm.role}
                        onChange={(e) =>
                          setUserForm({ ...userForm, role: e.target.value })
                        }
                        className="px-3 py-2 border border-slate-300 rounded"
                      >
                        <option value="user">User</option>
                        <option value="admin">Admin</option>
                      </select>
                    </div>
                    <div className="mt-4">
                      <label className="block text-sm font-medium mb-2">
                        Assign Locations
                      </label>
                      <div className="space-y-2">
                        {locations.map((loc) => (
                          <label key={loc.id} className="flex items-center">
                            <input
                              type="checkbox"
                              checked={userForm.locationIds.includes(loc.id)}
                              onChange={(e) => {
                                const ids = e.target.checked
                                  ? [...userForm.locationIds, loc.id]
                                  : userForm.locationIds.filter((id) => id !== loc.id);
                                setUserForm({ ...userForm, locationIds: ids });
                              }}
                              className="mr-2"
                            />
                            {loc.name} ({loc.warehouse_code})
                          </label>
                        ))}
                      </div>
                    </div>
                    <button
                      type="submit"
                      className="mt-4 px-4 py-2 bg-green-600 text-white rounded hover:bg-green-700"
                    >
                      Create User
                    </button>
                  </form>
                )}

                <div className="bg-white rounded-lg border border-slate-200">
                  <table className="w-full">
                    <thead className="border-b border-slate-200 bg-slate-50">
                      <tr>
                        <th className="px-6 py-3 text-left text-sm font-medium text-slate-600">
                          Email
                        </th>
                        <th className="px-6 py-3 text-left text-sm font-medium text-slate-600">
                          Name
                        </th>
                        <th className="px-6 py-3 text-left text-sm font-medium text-slate-600">
                          Role
                        </th>
                        <th className="px-6 py-3 text-left text-sm font-medium text-slate-600">
                          Locations
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {users.map((u) => (
                        <tr key={u.id} className="border-b border-slate-200 hover:bg-slate-50">
                          <td className="px-6 py-3 text-sm">{u.email}</td>
                          <td className="px-6 py-3 text-sm">{u.name}</td>
                          <td className="px-6 py-3 text-sm">
                            <span className={`px-2 py-1 rounded text-xs font-medium ${
                              u.role === "admin"
                                ? "bg-red-100 text-red-700"
                                : "bg-blue-100 text-blue-700"
                            }`}>
                              {u.role}
                            </span>
                          </td>
                          <td className="px-6 py-3 text-sm">
                            {u.locations?.map((l) => l.name).join(", ") || "None"}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* Locations Tab */}
            {activeTab === "locations" && (
              <div>
                <div className="flex justify-between items-center mb-4">
                  <h2 className="text-xl font-bold">Warehouse Locations</h2>
                  <button
                    onClick={() => setShowLocationForm(!showLocationForm)}
                    className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
                  >
                    {showLocationForm ? "Cancel" : "+ New Location"}
                  </button>
                </div>

                {showLocationForm && (
                  <form onSubmit={handleCreateLocation} className="bg-white p-6 rounded-lg mb-6 border border-slate-200">
                    <div className="grid grid-cols-2 gap-4">
                      <input
                        type="text"
                        placeholder="Location Name"
                        value={locationForm.name}
                        onChange={(e) =>
                          setLocationForm({ ...locationForm, name: e.target.value })
                        }
                        required
                        className="px-3 py-2 border border-slate-300 rounded"
                      />
                      <input
                        type="text"
                        placeholder="Warehouse Code"
                        value={locationForm.warehouseCode}
                        onChange={(e) =>
                          setLocationForm({
                            ...locationForm,
                            warehouseCode: e.target.value,
                          })
                        }
                        required
                        className="px-3 py-2 border border-slate-300 rounded"
                      />
                    </div>
                    <button
                      type="submit"
                      className="mt-4 px-4 py-2 bg-green-600 text-white rounded hover:bg-green-700"
                    >
                      Create Location
                    </button>
                  </form>
                )}

                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  {locations.map((loc) => (
                    <div key={loc.id} className="bg-white p-4 rounded-lg border border-slate-200">
                      <h3 className="font-bold text-lg">{loc.name}</h3>
                      <p className="text-slate-600 text-sm">{loc.warehouse_code}</p>
                      <p className="text-xs text-slate-500 mt-2">
                        Created: {new Date(loc.created_at).toLocaleDateString()}
                      </p>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Requests Tab */}
            {activeTab === "requests" && (
              <div>
                <h2 className="text-xl font-bold mb-4">Pending Requests</h2>
                <div className="bg-white rounded-lg border border-slate-200">
                  <table className="w-full text-sm">
                    <thead className="border-b border-slate-200 bg-slate-50">
                      <tr>
                        <th className="px-6 py-3 text-left font-medium text-slate-600">
                          Part Number
                        </th>
                        <th className="px-6 py-3 text-left font-medium text-slate-600">
                          Type
                        </th>
                        <th className="px-6 py-3 text-left font-medium text-slate-600">
                          Quantity
                        </th>
                        <th className="px-6 py-3 text-left font-medium text-slate-600">
                          Status
                        </th>
                        <th className="px-6 py-3 text-left font-medium text-slate-600">
                          Note
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {orderQueue.map((order) => (
                        <tr key={order.id} className="border-b border-slate-200 hover:bg-slate-50">
                          <td className="px-6 py-3">{order.part_number}</td>
                          <td className="px-6 py-3">
                            <span className="px-2 py-1 bg-blue-100 text-blue-700 rounded text-xs font-medium">
                              {order.request_type}
                            </span>
                          </td>
                          <td className="px-6 py-3">{order.requested_qty || "—"}</td>
                          <td className="px-6 py-3">
                            <span className={`px-2 py-1 rounded text-xs font-medium ${
                              order.status === "pending" ? "bg-yellow-100 text-yellow-700" : "bg-gray-100 text-gray-700"
                            }`}>
                              {order.status}
                            </span>
                          </td>
                          <td className="px-6 py-3 text-xs text-slate-600">{order.note}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* Inventory Tab */}
            {activeTab === "inventory" && (
              <div>
                <h2 className="text-xl font-bold mb-4">All Inventory</h2>
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
                        <th className="px-6 py-3 text-left font-medium text-slate-600">
                          Current
                        </th>
                        <th className="px-6 py-3 text-left font-medium text-slate-600">
                          Min
                        </th>
                        <th className="px-6 py-3 text-left font-medium text-slate-600">
                          Max
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {inventory.map((item) => (
                        <tr key={`${item.part_number}-${item.location_id}`} className="border-b border-slate-200 hover:bg-slate-50">
                          <td className="px-6 py-3 font-medium">{item.part_number}</td>
                          <td className="px-6 py-3">{item.description}</td>
                          <td className="px-6 py-3">{item.current_qty}</td>
                          <td className="px-6 py-3">{item.min_qty}</td>
                          <td className="px-6 py-3">{item.max_qty}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}

export default AdminDashboard;
