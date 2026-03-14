"use client";

import { useEffect, useState } from "react";

interface User {
  id: string;
  email: string;
  fullName: string;
  role: string;
  emailVerified: boolean;
  createdAt: string;
}

const roleCycle: Record<string, string> = {
  new_user: "new_account",
  new_account: "parent",
  parent: "admin",
  admin: "parent",
};

const roleColors: Record<string, string> = {
  admin: "bg-gold-200 text-forest-900",
  parent: "bg-forest-100 text-forest-700",
  new_account: "bg-blue-100 text-blue-800",
  new_user: "bg-orange-100 text-orange-800",
};

const roleActions: Record<string, string> = {
  new_user: "Approve → New Account",
  new_account: "Promote → Parent",
  parent: "Promote → Admin",
  admin: "Demote → Parent",
};

export default function AdminUsersPage() {
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadUsers();
  }, []);

  async function loadUsers() {
    const res = await fetch("/portal/api/admin/users");
    const data = await res.json();
    setUsers(data.users || []);
    setLoading(false);
  }

  async function changeRole(userId: string, currentRole: string) {
    const newRole = roleCycle[currentRole] || "parent";
    await fetch("/portal/api/admin/users", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ userId, role: newRole }),
    });
    loadUsers();
  }

  if (loading) {
    return (
      <div>
        <div className="mb-2 h-7 w-44 animate-pulse rounded-lg bg-paper-200" />
        <div className="mb-8 h-4 w-56 animate-pulse rounded-lg bg-paper-200" />
        <div className="space-y-3">
          {[1, 2, 3, 4, 5].map((i) => (
            <div key={i} className="h-14 animate-pulse rounded-xl bg-paper-100" />
          ))}
        </div>
      </div>
    );
  }

  const pendingUsers = users.filter((u) => u.role === "new_user" || u.role === "new_account");
  const activeUsers = users.filter((u) => u.role !== "new_user" && u.role !== "new_account");

  return (
    <div>
      <h1 className="mb-1 text-2xl font-bold text-forest-900">
        Manage Users
      </h1>
      <p className="mb-8 text-forest-600">
        Approve new accounts and manage roles
      </p>

      {pendingUsers.length > 0 && (
        <div className="mb-8">
          <h2 className="mb-3 text-sm font-semibold uppercase tracking-wider text-orange-700">
            Pending Approval ({pendingUsers.length})
          </h2>
          <div className="rounded-xl border-2 border-orange-200 bg-orange-50">
            {pendingUsers.map((user) => (
              <div
                key={user.id}
                className="flex items-center justify-between border-b border-orange-100 p-4 last:border-0"
              >
                <div>
                  <div className="font-medium text-forest-900">
                    {user.fullName}
                  </div>
                  <div className="text-sm text-forest-600">{user.email}</div>
                  <div className="text-xs text-forest-500">
                    Joined {new Date(user.createdAt).toLocaleDateString()}
                    {!user.emailVerified && (
                      <span className="ml-2 text-red-500">Email not verified</span>
                    )}
                  </div>
                </div>
                <button
                  onClick={() => changeRole(user.id, user.role)}
                  className="rounded-lg bg-forest-700 px-4 py-2 text-sm font-medium text-white transition hover:bg-forest-600"
                >
                  Approve
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="rounded-xl border border-paper-200 bg-white">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-paper-200 text-left">
                <th className="px-4 py-3 font-medium text-forest-600">Name</th>
                <th className="px-4 py-3 font-medium text-forest-600">Email</th>
                <th className="px-4 py-3 font-medium text-forest-600">Role</th>
                <th className="px-4 py-3 font-medium text-forest-600">Joined</th>
                <th className="px-4 py-3 font-medium text-forest-600">Actions</th>
              </tr>
            </thead>
            <tbody>
              {activeUsers.map((user) => (
                <tr
                  key={user.id}
                  className="border-b border-paper-100 last:border-0"
                >
                  <td className="px-4 py-3 font-medium text-forest-900">
                    {user.fullName}
                  </td>
                  <td className="px-4 py-3 text-forest-600">{user.email}</td>
                  <td className="px-4 py-3">
                    <span
                      className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${
                        roleColors[user.role] || "bg-gray-100 text-gray-800"
                      }`}
                    >
                      {user.role}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-forest-500">
                    {new Date(user.createdAt).toLocaleDateString()}
                  </td>
                  <td className="px-4 py-3">
                    <button
                      onClick={() => changeRole(user.id, user.role)}
                      className="text-sm font-medium text-forest-600 hover:text-forest-800"
                    >
                      {roleActions[user.role]}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
