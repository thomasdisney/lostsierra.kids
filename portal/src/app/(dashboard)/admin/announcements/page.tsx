"use client";

import { useEffect, useState } from "react";

interface Announcement {
  id: string;
  title: string;
  body: string;
  audience: string;
  pinned: boolean;
  publishedAt: string | null;
  createdAt: string;
}

export default function AdminAnnouncementsPage() {
  const [announcements, setAnnouncements] = useState<Announcement[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [audience, setAudience] = useState("all");
  const [pinned, setPinned] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    load();
  }, []);

  async function load() {
    const res = await fetch("/portal/api/admin/announcements");
    const data = await res.json();
    setAnnouncements(data.announcements || []);
    setLoading(false);
  }

  function resetForm() {
    setTitle("");
    setBody("");
    setAudience("all");
    setPinned(false);
    setEditId(null);
    setShowForm(false);
  }

  function editAnnouncement(a: Announcement) {
    setTitle(a.title);
    setBody(a.body);
    setAudience(a.audience);
    setPinned(a.pinned);
    setEditId(a.id);
    setShowForm(true);
  }

  async function handleSubmit(publish: boolean) {
    setSaving(true);
    if (editId) {
      await fetch("/portal/api/admin/announcements", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: editId, title, body, audience, pinned, publish }),
      });
    } else {
      await fetch("/portal/api/admin/announcements", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title, body, audience, pinned, publish }),
      });
    }
    setSaving(false);
    resetForm();
    load();
  }

  async function handleDelete(id: string) {
    await fetch("/portal/api/admin/announcements", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id }),
    });
    load();
  }

  async function togglePin(id: string, currentPinned: boolean) {
    await fetch("/portal/api/admin/announcements", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id, pinned: !currentPinned }),
    });
    load();
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
      <div className="mb-8 flex items-center justify-between">
        <div>
          <h1 className="mb-1 text-2xl font-bold text-forest-900">
            Announcements
          </h1>
          <p className="text-forest-600">Create and manage announcements</p>
        </div>
        <button
          onClick={() => {
            resetForm();
            setShowForm(true);
          }}
          className="rounded-lg bg-forest-700 px-4 py-2 text-sm font-medium text-white transition hover:bg-forest-600"
        >
          New Announcement
        </button>
      </div>

      {showForm && (
        <div className="mb-8 rounded-xl border border-paper-200 bg-white p-6">
          <h2 className="mb-4 font-semibold text-forest-900">
            {editId ? "Edit Announcement" : "New Announcement"}
          </h2>
          <div className="mb-4">
            <label className="mb-1 block text-sm font-medium text-forest-700">
              Title
            </label>
            <input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="w-full rounded-lg border border-paper-200 px-3 py-2 text-sm focus:border-forest-500 focus:outline-none"
              placeholder="Announcement title"
            />
          </div>
          <div className="mb-4">
            <label className="mb-1 block text-sm font-medium text-forest-700">
              Body
            </label>
            <textarea
              value={body}
              onChange={(e) => setBody(e.target.value)}
              rows={4}
              className="w-full rounded-lg border border-paper-200 px-3 py-2 text-sm focus:border-forest-500 focus:outline-none"
              placeholder="Announcement body..."
            />
          </div>
          <div className="mb-4 flex gap-4">
            <div className="flex-1">
              <label className="mb-1 block text-sm font-medium text-forest-700">
                Audience
              </label>
              <select
                value={audience}
                onChange={(e) => setAudience(e.target.value)}
                className="w-full rounded-lg border border-paper-200 px-3 py-2 text-sm focus:border-forest-500 focus:outline-none"
              >
                <option value="all">Everyone</option>
                <option value="parents">Parents Only</option>
                <option value="admin">Admin Only</option>
              </select>
            </div>
            <label className="flex items-center gap-2 self-end pb-2">
              <input
                type="checkbox"
                checked={pinned}
                onChange={(e) => setPinned(e.target.checked)}
              />
              <span className="text-sm text-forest-700">Pin to top</span>
            </label>
          </div>
          <div className="flex gap-3">
            <button
              onClick={() => handleSubmit(true)}
              disabled={saving || !title || !body}
              className="rounded-lg bg-forest-700 px-4 py-2 text-sm font-medium text-white transition hover:bg-forest-600 disabled:opacity-50"
            >
              {saving ? "Saving..." : "Publish"}
            </button>
            <button
              onClick={() => handleSubmit(false)}
              disabled={saving || !title || !body}
              className="rounded-lg border border-paper-300 px-4 py-2 text-sm font-medium text-forest-700 transition hover:bg-paper-100 disabled:opacity-50"
            >
              Save Draft
            </button>
            <button
              onClick={resetForm}
              className="px-4 py-2 text-sm text-forest-500 hover:text-forest-700"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      <div className="space-y-3">
        {announcements.length === 0 ? (
          <div className="rounded-xl border border-paper-200 bg-white p-8 text-center text-forest-500">
            No announcements yet
          </div>
        ) : (
          announcements.map((a) => (
            <div
              key={a.id}
              className="rounded-xl border border-paper-200 bg-white p-4"
            >
              <div className="mb-2 flex items-start justify-between">
                <div className="flex items-center gap-2">
                  {a.pinned && (
                    <span className="text-xs font-medium text-gold-600">
                      PINNED
                    </span>
                  )}
                  <h3 className="font-semibold text-forest-900">{a.title}</h3>
                </div>
                <div className="flex items-center gap-2">
                  <span
                    className={`rounded-full px-2 py-0.5 text-xs ${
                      a.publishedAt
                        ? "bg-green-100 text-green-700"
                        : "bg-gray-100 text-gray-600"
                    }`}
                  >
                    {a.publishedAt ? "Published" : "Draft"}
                  </span>
                  <span className="rounded-full bg-paper-100 px-2 py-0.5 text-xs text-forest-600">
                    {a.audience}
                  </span>
                </div>
              </div>
              <p className="mb-3 text-sm text-forest-600 line-clamp-2">
                {a.body}
              </p>
              <div className="flex items-center justify-between">
                <span className="text-xs text-forest-500">
                  {new Date(a.createdAt).toLocaleDateString()}
                </span>
                <div className="flex gap-2">
                  <button
                    onClick={() => togglePin(a.id, a.pinned)}
                    className="text-xs text-forest-500 hover:text-forest-700"
                  >
                    {a.pinned ? "Unpin" : "Pin"}
                  </button>
                  <button
                    onClick={() => editAnnouncement(a)}
                    className="text-xs text-forest-500 hover:text-forest-700"
                  >
                    Edit
                  </button>
                  <button
                    onClick={() => handleDelete(a.id)}
                    className="text-xs text-red-500 hover:text-red-700"
                  >
                    Delete
                  </button>
                </div>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
