"use client";

import { useEffect, useState, useRef } from "react";

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
  new_user: "Approve \u2192 New Account",
  new_account: "Promote \u2192 Parent",
  parent: "Promote \u2192 Admin",
  admin: "Demote \u2192 Parent",
};

/* ── Confirmation Modal ─────────────────────────────────────── */
function ConfirmModal({
  open,
  title,
  message,
  confirmLabel,
  destructive,
  onConfirm,
  onCancel,
}: {
  open: boolean;
  title: string;
  message: string;
  confirmLabel: string;
  destructive?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={onCancel}>
      <div className="w-full max-w-sm rounded-2xl bg-white p-6 shadow-2xl" onClick={(e) => e.stopPropagation()}>
        <h3 className="mb-1 text-lg font-bold text-forest-900">{title}</h3>
        <p className="mb-6 text-sm text-forest-600">{message}</p>
        <div className="flex items-center justify-end gap-3">
          <button
            onClick={onCancel}
            className="rounded-xl border border-paper-300 px-4 py-2 text-sm font-medium text-forest-700 transition hover:bg-paper-100"
          >
            Cancel
          </button>
          <button
            onClick={onConfirm}
            className={`rounded-xl px-4 py-2 text-sm font-bold text-white transition ${
              destructive
                ? "bg-red-600 hover:bg-red-700"
                : "bg-forest-700 hover:bg-forest-600"
            }`}
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}

/* ── Action Menu (per-row "..." button) ─────────────────────── */
function ActionMenu({
  user,
  onChangeRole,
  onDelete,
}: {
  user: User;
  onChangeRole: (userId: string, currentRole: string) => void;
  onDelete: (userId: string, name: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [open]);

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={() => setOpen(!open)}
        className="rounded-lg p-1.5 text-forest-500 transition hover:bg-paper-100 hover:text-forest-700"
        aria-label="Actions"
      >
        <svg className="h-5 w-5" fill="currentColor" viewBox="0 0 20 20">
          <circle cx="10" cy="4" r="1.5" />
          <circle cx="10" cy="10" r="1.5" />
          <circle cx="10" cy="16" r="1.5" />
        </svg>
      </button>
      {open && (
        <div className="absolute right-0 top-full z-10 mt-1 w-48 rounded-xl border border-paper-200 bg-white py-1 shadow-lg">
          <button
            onClick={() => { onChangeRole(user.id, user.role); setOpen(false); }}
            className="flex w-full items-center gap-2 px-4 py-2 text-left text-sm text-forest-700 transition hover:bg-paper-50"
          >
            <svg className="h-4 w-4 shrink-0" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
            </svg>
            {roleActions[user.role]}
          </button>
          <button
            onClick={() => { onDelete(user.id, user.fullName); setOpen(false); }}
            className="flex w-full items-center gap-2 px-4 py-2 text-left text-sm text-red-600 transition hover:bg-red-50"
          >
            <svg className="h-4 w-4 shrink-0" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
            </svg>
            Delete user
          </button>
        </div>
      )}
    </div>
  );
}

/* ── Main Page ──────────────────────────────────────────────── */
export default function AdminUsersPage() {
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [deleting, setDeleting] = useState(false);

  // Confirmation modal state
  const [confirmModal, setConfirmModal] = useState<{
    title: string;
    message: string;
    confirmLabel: string;
    destructive?: boolean;
    onConfirm: () => void;
  } | null>(null);

  useEffect(() => {
    loadUsers();
  }, []);

  async function loadUsers() {
    const res = await fetch("/portal/api/admin/users");
    const data = await res.json();
    setUsers(data.users || []);
    setLoading(false);
  }

  function confirmAction(opts: {
    title: string;
    message: string;
    confirmLabel: string;
    destructive?: boolean;
    onConfirm: () => void;
  }) {
    setConfirmModal(opts);
  }

  async function changeRole(userId: string, currentRole: string) {
    const newRole = roleCycle[currentRole] || "parent";
    const action = roleActions[currentRole] || `Change to ${newRole}`;
    const userName = users.find((u) => u.id === userId)?.fullName || "this user";
    confirmAction({
      title: "Change role",
      message: `${action} for ${userName}?`,
      confirmLabel: action.split(" \u2192 ")[0],
      onConfirm: async () => {
        setConfirmModal(null);
        await fetch("/portal/api/admin/users", {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ userId, role: newRole }),
        });
        loadUsers();
      },
    });
  }

  function toggleSelect(id: string) {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function toggleSelectAll(userList: User[]) {
    const ids = userList.map((u) => u.id);
    const allSelected = ids.every((id) => selectedIds.has(id));
    if (allSelected) {
      setSelectedIds((prev) => {
        const next = new Set(prev);
        ids.forEach((id) => next.delete(id));
        return next;
      });
    } else {
      setSelectedIds((prev) => new Set([...prev, ...ids]));
    }
  }

  function requestDeleteSelected() {
    if (selectedIds.size === 0) return;
    confirmAction({
      title: "Delete users",
      message: `Permanently delete ${selectedIds.size} user(s)? This removes all their data and cannot be undone.`,
      confirmLabel: `Delete ${selectedIds.size} user(s)`,
      destructive: true,
      onConfirm: async () => {
        setConfirmModal(null);
        setDeleting(true);
        try {
          await fetch("/portal/api/admin/users", {
            method: "DELETE",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ userIds: [...selectedIds] }),
          });
          setSelectedIds(new Set());
          loadUsers();
        } finally {
          setDeleting(false);
        }
      },
    });
  }

  function requestDeleteSingle(userId: string, name: string) {
    setSelectedIds(new Set([userId]));
    confirmAction({
      title: "Delete user",
      message: `Permanently delete ${name}? This removes all their data and cannot be undone.`,
      confirmLabel: "Delete",
      destructive: true,
      onConfirm: async () => {
        setConfirmModal(null);
        setDeleting(true);
        try {
          await fetch("/portal/api/admin/users", {
            method: "DELETE",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ userIds: [userId] }),
          });
          setSelectedIds(new Set());
          loadUsers();
        } finally {
          setDeleting(false);
        }
      },
    });
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
      <ConfirmModal
        open={!!confirmModal}
        title={confirmModal?.title || ""}
        message={confirmModal?.message || ""}
        confirmLabel={confirmModal?.confirmLabel || "Confirm"}
        destructive={confirmModal?.destructive}
        onConfirm={confirmModal?.onConfirm || (() => {})}
        onCancel={() => setConfirmModal(null)}
      />

      <div className="mb-8 flex items-center justify-between">
        <div>
          <h1 className="mb-1 text-2xl font-bold text-forest-900">Manage Users</h1>
          <p className="text-forest-600">Approve new accounts and manage roles</p>
        </div>
        {selectedIds.size > 0 && (
          <button
            onClick={requestDeleteSelected}
            disabled={deleting}
            className="rounded-xl bg-red-600 px-4 py-2 text-sm font-bold text-white transition hover:bg-red-700 disabled:opacity-60"
          >
            {deleting ? "Deleting\u2026" : `Delete Selected (${selectedIds.size})`}
          </button>
        )}
      </div>

      {pendingUsers.length > 0 && (
        <div className="mb-8">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-sm font-semibold uppercase tracking-wider text-orange-700">
              Pending Approval ({pendingUsers.length})
            </h2>
            <button
              onClick={() => toggleSelectAll(pendingUsers)}
              className="rounded-lg border border-paper-300 px-3 py-1.5 text-xs font-medium text-forest-700 transition hover:bg-paper-100"
            >
              {pendingUsers.every((u) => selectedIds.has(u.id)) ? "Deselect All" : "Select All"}
            </button>
          </div>
          <div className="rounded-xl border-2 border-orange-200 bg-orange-50">
            {pendingUsers.map((user) => (
              <div
                key={user.id}
                className="flex items-center justify-between border-b border-orange-100 p-4 last:border-0"
              >
                <div className="flex items-center gap-3">
                  <input
                    type="checkbox"
                    checked={selectedIds.has(user.id)}
                    onChange={() => toggleSelect(user.id)}
                    className="h-4 w-4 rounded border-paper-300 text-forest-600 focus:ring-forest-500"
                  />
                  <div>
                    <div className="font-medium text-forest-900">{user.fullName}</div>
                    <div className="text-sm text-forest-600">{user.email}</div>
                    <div className="text-xs text-forest-500">
                      Joined {new Date(user.createdAt).toLocaleDateString()}
                      {!user.emailVerified && (
                        <span className="ml-2 text-red-500">Email not verified</span>
                      )}
                    </div>
                  </div>
                </div>
                <ActionMenu user={user} onChangeRole={changeRole} onDelete={requestDeleteSingle} />
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
                <th className="w-10 px-4 py-3">
                  <input
                    type="checkbox"
                    checked={activeUsers.length > 0 && activeUsers.every((u) => selectedIds.has(u.id))}
                    onChange={() => toggleSelectAll(activeUsers)}
                    className="h-4 w-4 rounded border-paper-300 text-forest-600 focus:ring-forest-500"
                  />
                </th>
                <th className="px-4 py-3 font-medium text-forest-600">Name</th>
                <th className="px-4 py-3 font-medium text-forest-600">Email</th>
                <th className="px-4 py-3 font-medium text-forest-600">Role</th>
                <th className="px-4 py-3 font-medium text-forest-600">Joined</th>
                <th className="w-10 px-4 py-3"></th>
              </tr>
            </thead>
            <tbody>
              {activeUsers.map((user) => (
                <tr
                  key={user.id}
                  className="border-b border-paper-100 last:border-0"
                >
                  <td className="px-4 py-3">
                    <input
                      type="checkbox"
                      checked={selectedIds.has(user.id)}
                      onChange={() => toggleSelect(user.id)}
                      className="h-4 w-4 rounded border-paper-300 text-forest-600 focus:ring-forest-500"
                    />
                  </td>
                  <td className="px-4 py-3 font-medium text-forest-900">{user.fullName}</td>
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
                    <ActionMenu user={user} onChangeRole={changeRole} onDelete={requestDeleteSingle} />
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
