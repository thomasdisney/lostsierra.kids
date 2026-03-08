"use client";

import { useEffect, useState } from "react";

interface Announcement {
  id: string;
  title: string;
  body: string;
  audience: string;
  pinned: boolean;
  publishedAt: string;
  isRead: boolean;
}

export default function AnnouncementsPage() {
  const [announcements, setAnnouncements] = useState<Announcement[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    load();
  }, []);

  async function load() {
    const res = await fetch("/portal/api/announcements");
    const data = await res.json();
    setAnnouncements(data.announcements || []);
    setLoading(false);
  }

  async function markAsRead(id: string) {
    await fetch("/portal/api/announcements/read", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ announcementId: id }),
    });
    setAnnouncements((prev) =>
      prev.map((a) => (a.id === id ? { ...a, isRead: true } : a))
    );
  }

  if (loading) {
    return (
      <div className="flex h-64 items-center justify-center">
        <div className="text-forest-500">Loading...</div>
      </div>
    );
  }

  const unreadCount = announcements.filter((a) => !a.isRead).length;

  return (
    <div>
      <h1 className="mb-1 text-2xl font-bold text-forest-900">
        Announcements
      </h1>
      <p className="mb-8 text-forest-600">
        {unreadCount > 0
          ? `${unreadCount} unread announcement${unreadCount > 1 ? "s" : ""}`
          : "All caught up"}
      </p>

      {announcements.length === 0 ? (
        <div className="rounded-xl border border-paper-200 bg-white p-8 text-center text-forest-500">
          No announcements yet
        </div>
      ) : (
        <div className="space-y-3">
          {announcements.map((a) => (
            <div
              key={a.id}
              className={`rounded-xl border bg-white p-5 transition ${
                a.isRead
                  ? "border-paper-200"
                  : "border-forest-300 shadow-sm"
              }`}
              onClick={() => !a.isRead && markAsRead(a.id)}
            >
              <div className="mb-2 flex items-start justify-between">
                <div className="flex items-center gap-2">
                  {a.pinned && (
                    <span className="text-xs font-medium text-gold-600">
                      PINNED
                    </span>
                  )}
                  {!a.isRead && (
                    <span className="h-2 w-2 rounded-full bg-forest-500" />
                  )}
                  <h3 className="font-semibold text-forest-900">{a.title}</h3>
                </div>
                <span className="text-xs text-forest-500">
                  {new Date(a.publishedAt).toLocaleDateString()}
                </span>
              </div>
              <p className="whitespace-pre-wrap text-sm text-forest-600">
                {a.body}
              </p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
