"use client";

import { useEffect, useState } from "react";

interface User {
  id: string;
  email: string;
  fullName: string;
  role: string;
  createdAt: string;
}

export default function AdminUsersPage() {
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadUsers();
  }, []);

  async function loadUsers() {
    const res = await fetch("/api/admin/users");
    const data = await res.json();
    setUsers(data.users || []);
    setLoading(false);
  }

  async function toggleRole(userId: string, currentRole: string) {
    const newRole = currentRole === "admin" ? "parent" : "admin";
    await fetch("/api/admin/users", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ userId, role: newRole }),
    });
    loadUsers();
  }

  if (loading) {
    return (
      <div className="flex h-64 items-center justify-center">
        <div className="text-forest-500">Loading...</div>
      </div>
    );
  }

  return (
    <div>
      <h1 className="mb-1 text-2xl font-bold text-forest-900">
        Manage Users
      </h1>
      <p className="mb-8 text-forest-600">
        View all accounts and manage admin roles
      </p>

      <div className="rounded-xl border border-paper-200 bg-white">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-paper-200 text-left">
                <th className="px-4 py-3 font-medium text-forest-600">Name</th>
                <th className="px-4 py-3 font-medium text-forest-600">
                  Email
                </th>
                <th className="px-4 py-3 font-medium text-forest-600">Role</th>
                <th className="px-4 py-3 font-medium text-forest-600">
                  Joined
                </th>
                <th className="px-4 py-3 font-medium text-forest-600">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody>
              {users.map((user) => (
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
                        user.role === "admin"
                          ? "bg-gold-200 text-forest-900"
                          : "bg-forest-100 text-forest-700"
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
                      onClick={() => toggleRole(user.id, user.role)}
                      className="text-sm font-medium text-forest-600 hover:text-forest-800"
                    >
                      {user.role === "admin"
                        ? "Demote to Parent"
                        : "Promote to Admin"}
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
