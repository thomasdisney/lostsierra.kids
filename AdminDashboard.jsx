import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "./AuthContext";

const NAV_ITEMS = [
  { id: "accounts", label: "User Accounts", icon: "M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" },
  { id: "locations", label: "Locations", icon: "M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z M15 11a3 3 0 11-6 0 3 3 0 016 0z" },
  { id: "requests", label: "Requests", icon: "M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" },
  { id: "inventory", label: "Inventory", icon: "M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" },
];

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

  const [showUserForm, setShowUserForm] = useState(false);
  const [showLocationForm, setShowLocationForm] = useState(false);
  const [userForm, setUserForm] = useState({
    email: "", password: "", name: "", role: "user", locationIds: [],
  });
  const [locationForm, setLocationForm] = useState({ name: "", warehouseCode: "" });

  useEffect(() => { fetchData(); }, [activeTab]);

  async function fetchData() {
    try {
      setLoading(true);
      const headers = { Authorization: `Bearer ${token}` };

      const [usersRes, locsRes, invRes] = await Promise.all([
        fetch("/api/admin/users", { headers }),
        fetch("/api/admin/locations", { headers }),
        fetch("/api/inventory", { headers }),
      ]);

      if (usersRes.ok) setUsers((await usersRes.json()).users);
      if (locsRes.ok) setLocations((await locsRes.json()).locations);
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
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify(userForm),
      });
      if (response.ok) {
        setUserForm({ email: "", password: "", name: "", role: "user", locationIds: [] });
        setShowUserForm(false);
        await fetchData();
      } else {
        setError((await response.json()).error || "Failed to create user");
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
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify(locationForm),
      });
      if (response.ok) {
        setLocationForm({ name: "", warehouseCode: "" });
        setShowLocationForm(false);
        await fetchData();
      } else {
        setError((await response.json()).error || "Failed to create location");
      }
    } catch (err) {
      setError("Error: " + err.message);
    }
  }

  async function handleApproveAdjustment(id) {
    try {
      const response = await fetch("/api/inventory", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ action: "approve_adjustment", id }),
      });
      if (response.ok) await fetchData();
      else setError((await response.json()).error || "Failed to approve");
    } catch (err) {
      setError("Error: " + err.message);
    }
  }

  async function handleDenyAdjustment(id) {
    try {
      const response = await fetch("/api/inventory", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ action: "deny_adjustment", id }),
      });
      if (response.ok) await fetchData();
      else setError((await response.json()).error || "Failed to deny");
    } catch (err) {
      setError("Error: " + err.message);
    }
  }

  function handleLogout() {
    logout();
    navigate("/login");
  }

  return (
    <div className="min-h-screen wms-grid-bg flex">
      {/* Sidebar */}
      <aside className="w-64 bg-slate-900/80 backdrop-blur-sm border-r border-slate-700/50 flex flex-col">
        {/* Logo */}
        <div className="p-6 border-b border-slate-700/50">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-cyan-500 to-cyan-600 flex items-center justify-center wms-glow">
              <svg className="w-5 h-5 text-slate-900" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
              </svg>
            </div>
            <div>
              <h1 className="text-lg font-bold text-white">WMS<span className="text-cyan-400">.</span></h1>
              <p className="text-[10px] text-slate-500 uppercase tracking-wider">Admin Console</p>
            </div>
          </div>
        </div>

        {/* Navigation */}
        <nav className="flex-1 p-4 space-y-1">
          {NAV_ITEMS.map((item) => (
            <button
              key={item.id}
              onClick={() => setActiveTab(item.id)}
              className={`wms-nav-item w-full text-left ${activeTab === item.id ? "active" : ""}`}
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d={item.icon} />
              </svg>
              <span className="text-sm">{item.label}</span>
              {item.id === "requests" && orderQueue.filter(o => o.status === "pending").length > 0 && (
                <span className="ml-auto px-2 py-0.5 text-xs font-mono bg-amber-500/20 text-amber-400 rounded">
                  {orderQueue.filter(o => o.status === "pending").length}
                </span>
              )}
            </button>
          ))}
        </nav>

        {/* User section */}
        <div className="p-4 border-t border-slate-700/50">
          <div className="flex items-center gap-3 mb-3">
            <div className="w-8 h-8 rounded-full bg-gradient-to-br from-red-500 to-red-600 flex items-center justify-center text-xs font-bold text-white">
              {user?.name?.charAt(0) || "A"}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-white truncate">{user?.name}</p>
              <p className="text-xs text-slate-500 truncate">{user?.email}</p>
            </div>
          </div>
          <button
            onClick={handleLogout}
            className="w-full flex items-center justify-center gap-2 px-3 py-2 text-sm text-red-400 hover:text-red-300 hover:bg-red-500/10 rounded-lg transition"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
            </svg>
            <span>Sign Out</span>
          </button>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 overflow-auto">
        {/* Header */}
        <header className="sticky top-0 z-10 bg-slate-900/80 backdrop-blur-sm border-b border-slate-700/50 px-8 py-4">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-xl font-bold text-white capitalize">{activeTab}</h2>
              <p className="text-sm text-slate-500">Manage your warehouse operations</p>
            </div>
            <div className="flex items-center gap-2 text-xs font-mono text-slate-500">
              <div className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse-glow"></div>
              <span>SYSTEM ONLINE</span>
            </div>
          </div>
        </header>

        <div className="p-8">
          {error && (
            <div className="mb-6 p-4 bg-red-500/10 border border-red-500/30 rounded-lg flex items-center gap-3 animate-slide-up">
              <svg className="w-5 h-5 text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
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

          {loading ? (
            <div className="flex items-center justify-center h-64">
              <div className="flex items-center gap-3 text-slate-400">
                <svg className="animate-spin w-6 h-6" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"></path>
                </svg>
                <span className="text-sm font-mono">Loading data...</span>
              </div>
            </div>
          ) : (
            <>
              {/* Accounts Tab */}
              {activeTab === "accounts" && (
                <div className="animate-slide-up">
                  <div className="flex items-center justify-between mb-6">
                    <div>
                      <h3 className="text-lg font-semibold text-white">User Accounts</h3>
                      <p className="text-sm text-slate-500">{users.length} registered users</p>
                    </div>
                    <button
                      onClick={() => setShowUserForm(!showUserForm)}
                      className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition ${
                        showUserForm
                          ? "bg-slate-700 text-slate-300"
                          : "wms-btn-primary"
                      }`}
                    >
                      {showUserForm ? (
                        <><svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg><span>Cancel</span></>
                      ) : (
                        <><svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" /></svg><span>Add User</span></>
                      )}
                    </button>
                  </div>

                  {showUserForm && (
                    <form onSubmit={handleCreateUser} className="wms-card p-6 mb-6 animate-slide-up">
                      <h4 className="text-sm font-semibold text-cyan-400 uppercase tracking-wider mb-4">New User</h4>
                      <div className="grid grid-cols-2 gap-4 mb-4">
                        <div>
                          <label className="block text-xs text-slate-500 mb-1 uppercase">Email</label>
                          <input
                            type="email"
                            value={userForm.email}
                            onChange={(e) => setUserForm({ ...userForm, email: e.target.value })}
                            required
                            className="wms-input w-full px-3 py-2 rounded-lg text-sm"
                            placeholder="user@company.com"
                          />
                        </div>
                        <div>
                          <label className="block text-xs text-slate-500 mb-1 uppercase">Password</label>
                          <input
                            type="password"
                            value={userForm.password}
                            onChange={(e) => setUserForm({ ...userForm, password: e.target.value })}
                            required
                            className="wms-input w-full px-3 py-2 rounded-lg text-sm"
                            placeholder="••••••••"
                          />
                        </div>
                        <div>
                          <label className="block text-xs text-slate-500 mb-1 uppercase">Full Name</label>
                          <input
                            type="text"
                            value={userForm.name}
                            onChange={(e) => setUserForm({ ...userForm, name: e.target.value })}
                            required
                            className="wms-input w-full px-3 py-2 rounded-lg text-sm"
                            placeholder="John Smith"
                          />
                        </div>
                        <div>
                          <label className="block text-xs text-slate-500 mb-1 uppercase">Role</label>
                          <select
                            value={userForm.role}
                            onChange={(e) => setUserForm({ ...userForm, role: e.target.value })}
                            className="wms-input w-full px-3 py-2 rounded-lg text-sm"
                          >
                            <option value="user">User</option>
                            <option value="admin">Admin</option>
                          </select>
                        </div>
                      </div>
                      <div className="mb-4">
                        <label className="block text-xs text-slate-500 mb-2 uppercase">Assign Locations</label>
                        <div className="flex flex-wrap gap-2">
                          {locations.map((loc) => (
                            <label
                              key={loc.id}
                              className={`flex items-center gap-2 px-3 py-2 rounded-lg border cursor-pointer transition ${
                                userForm.locationIds.includes(loc.id)
                                  ? "border-cyan-500 bg-cyan-500/10 text-cyan-400"
                                  : "border-slate-700 text-slate-400 hover:border-slate-600"
                              }`}
                            >
                              <input
                                type="checkbox"
                                checked={userForm.locationIds.includes(loc.id)}
                                onChange={(e) => {
                                  const ids = e.target.checked
                                    ? [...userForm.locationIds, loc.id]
                                    : userForm.locationIds.filter((id) => id !== loc.id);
                                  setUserForm({ ...userForm, locationIds: ids });
                                }}
                                className="hidden"
                              />
                              <span className="text-sm">{loc.name}</span>
                              <span className="text-xs font-mono text-slate-500">{loc.warehouse_code}</span>
                            </label>
                          ))}
                        </div>
                      </div>
                      <button type="submit" className="wms-btn-primary px-6 py-2 rounded-lg text-sm">
                        Create User
                      </button>
                    </form>
                  )}

                  <div className="wms-card overflow-hidden">
                    <table className="wms-table w-full">
                      <thead>
                        <tr>
                          <th className="px-6 py-4 text-left">User</th>
                          <th className="px-6 py-4 text-left">Role</th>
                          <th className="px-6 py-4 text-left">Locations</th>
                          <th className="px-6 py-4 text-left">Status</th>
                        </tr>
                      </thead>
                      <tbody className="text-sm">
                        {users.map((u) => (
                          <tr key={u.id}>
                            <td className="px-6 py-4">
                              <div className="flex items-center gap-3">
                                <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold text-white ${
                                  u.role === "admin" ? "bg-gradient-to-br from-red-500 to-red-600" : "bg-gradient-to-br from-cyan-500 to-cyan-600"
                                }`}>
                                  {u.name?.charAt(0) || "?"}
                                </div>
                                <div>
                                  <p className="text-white font-medium">{u.name}</p>
                                  <p className="text-slate-500 text-xs font-mono">{u.email}</p>
                                </div>
                              </div>
                            </td>
                            <td className="px-6 py-4">
                              <span className={`wms-badge ${
                                u.role === "admin"
                                  ? "bg-red-500/20 text-red-400"
                                  : "bg-cyan-500/20 text-cyan-400"
                              }`}>
                                {u.role}
                              </span>
                            </td>
                            <td className="px-6 py-4">
                              <div className="flex flex-wrap gap-1">
                                {u.locations?.length > 0 ? (
                                  u.locations.map((l) => (
                                    <span key={l.id} className="px-2 py-0.5 text-xs bg-slate-700 text-slate-300 rounded font-mono">
                                      {l.warehouse_code}
                                    </span>
                                  ))
                                ) : (
                                  <span className="text-slate-600 text-xs">No locations</span>
                                )}
                              </div>
                            </td>
                            <td className="px-6 py-4">
                              <span className={`wms-badge ${
                                u.is_active !== false
                                  ? "bg-emerald-500/20 text-emerald-400"
                                  : "bg-slate-500/20 text-slate-400"
                              }`}>
                                {u.is_active !== false ? "Active" : "Inactive"}
                              </span>
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
                <div className="animate-slide-up">
                  <div className="flex items-center justify-between mb-6">
                    <div>
                      <h3 className="text-lg font-semibold text-white">Warehouse Locations</h3>
                      <p className="text-sm text-slate-500">{locations.length} active locations</p>
                    </div>
                    <button
                      onClick={() => setShowLocationForm(!showLocationForm)}
                      className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition ${
                        showLocationForm ? "bg-slate-700 text-slate-300" : "wms-btn-primary"
                      }`}
                    >
                      {showLocationForm ? (
                        <><svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg><span>Cancel</span></>
                      ) : (
                        <><svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" /></svg><span>Add Location</span></>
                      )}
                    </button>
                  </div>

                  {showLocationForm && (
                    <form onSubmit={handleCreateLocation} className="wms-card p-6 mb-6 animate-slide-up">
                      <h4 className="text-sm font-semibold text-cyan-400 uppercase tracking-wider mb-4">New Location</h4>
                      <div className="grid grid-cols-2 gap-4 mb-4">
                        <div>
                          <label className="block text-xs text-slate-500 mb-1 uppercase">Location Name</label>
                          <input
                            type="text"
                            value={locationForm.name}
                            onChange={(e) => setLocationForm({ ...locationForm, name: e.target.value })}
                            required
                            className="wms-input w-full px-3 py-2 rounded-lg text-sm"
                            placeholder="Main Warehouse"
                          />
                        </div>
                        <div>
                          <label className="block text-xs text-slate-500 mb-1 uppercase">Warehouse Code</label>
                          <input
                            type="text"
                            value={locationForm.warehouseCode}
                            onChange={(e) => setLocationForm({ ...locationForm, warehouseCode: e.target.value.toUpperCase() })}
                            required
                            className="wms-input w-full px-3 py-2 rounded-lg text-sm font-mono"
                            placeholder="MAIN-01"
                          />
                        </div>
                      </div>
                      <button type="submit" className="wms-btn-primary px-6 py-2 rounded-lg text-sm">
                        Create Location
                      </button>
                    </form>
                  )}

                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {locations.map((loc) => {
                      const locInventory = inventory.filter(i => i.location_id === loc.id);
                      const lowStock = locInventory.filter(i => i.current_qty <= i.min_qty).length;
                      return (
                        <div key={loc.id} className="wms-card p-5 hover:border-cyan-500/30 transition">
                          <div className="flex items-start justify-between mb-4">
                            <div className="w-12 h-12 rounded-lg bg-gradient-to-br from-cyan-500/20 to-cyan-600/20 flex items-center justify-center">
                              <svg className="w-6 h-6 text-cyan-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                              </svg>
                            </div>
                            <span className="px-2 py-1 text-xs font-mono bg-slate-700 text-cyan-400 rounded">
                              {loc.warehouse_code}
                            </span>
                          </div>
                          <h4 className="text-white font-semibold mb-1">{loc.name}</h4>
                          <p className="text-xs text-slate-500 mb-4">
                            Created {new Date(loc.created_at).toLocaleDateString()}
                          </p>
                          <div className="flex items-center gap-4 pt-4 border-t border-slate-700/50">
                            <div>
                              <p className="text-2xl font-bold font-mono text-white">{locInventory.length}</p>
                              <p className="text-xs text-slate-500">Items</p>
                            </div>
                            {lowStock > 0 && (
                              <div className="flex items-center gap-1 px-2 py-1 bg-amber-500/10 rounded">
                                <svg className="w-4 h-4 text-amber-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                                </svg>
                                <span className="text-xs font-mono text-amber-400">{lowStock} low</span>
                              </div>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Requests Tab */}
              {activeTab === "requests" && (
                <div className="animate-slide-up">
                  <div className="mb-6">
                    <h3 className="text-lg font-semibold text-white">Pending Requests</h3>
                    <p className="text-sm text-slate-500">Review and approve inventory adjustments</p>
                  </div>

                  {orderQueue.length === 0 ? (
                    <div className="wms-card p-12 text-center">
                      <svg className="w-12 h-12 text-slate-600 mx-auto mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                      </svg>
                      <p className="text-slate-400">No pending requests</p>
                    </div>
                  ) : (
                    <div className="wms-card overflow-hidden">
                      <table className="wms-table w-full">
                        <thead>
                          <tr>
                            <th className="px-6 py-4 text-left">Part</th>
                            <th className="px-6 py-4 text-left">Type</th>
                            <th className="px-6 py-4 text-left">Qty</th>
                            <th className="px-6 py-4 text-left">Status</th>
                            <th className="px-6 py-4 text-left">Note</th>
                            <th className="px-6 py-4 text-left">Actions</th>
                          </tr>
                        </thead>
                        <tbody className="text-sm">
                          {orderQueue.map((order) => (
                            <tr key={order.id}>
                              <td className="px-6 py-4">
                                <span className="font-mono text-white">{order.part_number}</span>
                              </td>
                              <td className="px-6 py-4">
                                <span className={`wms-badge ${
                                  order.request_type === "adjustment"
                                    ? "bg-purple-500/20 text-purple-400"
                                    : "bg-cyan-500/20 text-cyan-400"
                                }`}>
                                  {order.request_type}
                                </span>
                              </td>
                              <td className="px-6 py-4 font-mono text-white">
                                {order.requested_qty ?? "—"}
                              </td>
                              <td className="px-6 py-4">
                                <span className={`wms-badge ${
                                  order.status === "pending"
                                    ? "bg-amber-500/20 text-amber-400 wms-glow-amber"
                                    : order.status === "open"
                                    ? "bg-cyan-500/20 text-cyan-400"
                                    : "bg-slate-500/20 text-slate-400"
                                }`}>
                                  {order.status}
                                </span>
                              </td>
                              <td className="px-6 py-4 text-slate-400 text-xs max-w-xs truncate">
                                {order.note}
                              </td>
                              <td className="px-6 py-4">
                                {order.request_type === "adjustment" && order.status === "pending" && (
                                  <div className="flex items-center gap-2">
                                    <button
                                      onClick={() => handleApproveAdjustment(order.id)}
                                      className="p-2 rounded-lg bg-emerald-500/20 text-emerald-400 hover:bg-emerald-500/30 transition"
                                      title="Approve"
                                    >
                                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                                      </svg>
                                    </button>
                                    <button
                                      onClick={() => handleDenyAdjustment(order.id)}
                                      className="p-2 rounded-lg bg-red-500/20 text-red-400 hover:bg-red-500/30 transition"
                                      title="Deny"
                                    >
                                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                                      </svg>
                                    </button>
                                  </div>
                                )}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              )}

              {/* Inventory Tab */}
              {activeTab === "inventory" && (
                <div className="animate-slide-up">
                  <div className="mb-6">
                    <h3 className="text-lg font-semibold text-white">All Inventory</h3>
                    <p className="text-sm text-slate-500">{inventory.length} items across all locations</p>
                  </div>

                  <div className="wms-card overflow-hidden">
                    <table className="wms-table w-full">
                      <thead>
                        <tr>
                          <th className="px-6 py-4 text-left">Part Number</th>
                          <th className="px-6 py-4 text-left">Description</th>
                          <th className="px-6 py-4 text-left">Location</th>
                          <th className="px-6 py-4 text-center">Stock Level</th>
                          <th className="px-6 py-4 text-center">Status</th>
                        </tr>
                      </thead>
                      <tbody className="text-sm">
                        {inventory.map((item) => {
                          const location = locations.find(l => l.id === item.location_id);
                          const isLow = item.current_qty <= item.min_qty;
                          const percentage = Math.min(100, (item.current_qty / item.max_qty) * 100);
                          return (
                            <tr key={`${item.part_number}-${item.location_id}`}>
                              <td className="px-6 py-4">
                                <span className="font-mono text-white font-medium">{item.part_number}</span>
                              </td>
                              <td className="px-6 py-4 text-slate-400">{item.description}</td>
                              <td className="px-6 py-4">
                                <span className="px-2 py-0.5 text-xs font-mono bg-slate-700 text-cyan-400 rounded">
                                  {location?.warehouse_code || "—"}
                                </span>
                              </td>
                              <td className="px-6 py-4">
                                <div className="flex items-center gap-4">
                                  <div className="flex-1 max-w-24">
                                    <div className="stock-bar">
                                      <div
                                        className={`stock-bar-fill ${
                                          isLow ? "bg-red-500" : percentage < 50 ? "bg-amber-500" : "bg-emerald-500"
                                        }`}
                                        style={{ width: `${percentage}%` }}
                                      ></div>
                                    </div>
                                  </div>
                                  <span className="font-mono text-white text-xs w-20 text-right">
                                    {item.current_qty} / {item.max_qty}
                                  </span>
                                </div>
                              </td>
                              <td className="px-6 py-4 text-center">
                                <span className={`wms-badge ${
                                  isLow
                                    ? "bg-red-500/20 text-red-400 wms-glow-red"
                                    : "bg-emerald-500/20 text-emerald-400"
                                }`}>
                                  {isLow ? "Low Stock" : "OK"}
                                </span>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      </main>
    </div>
  );
}

export default AdminDashboard;
