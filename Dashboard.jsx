import React, { useState, useEffect } from "react";
import { createClient } from "@supabase/supabase-js";
import "./App.css";

const supabase = createClient(
  import.meta.env.VITE_SUPABASE_URL,
  import.meta.env.VITE_SUPABASE_ANON_KEY
);

function TierSection({ title, tickets, onMove, onDraftChange, onSend }) {
  return (
    <div className="tier-section">
      <h2 className="tier-title">
        {title} ({tickets.length})
      </h2>
      {tickets.length === 0 ? (
        <p className="tier-empty">No tickets here.</p>
      ) : (
        tickets.map(ticket => (
          <div key={ticket.id} className={`task-card ${ticket.tier === "completed" ? "completed" : ""}`}>
            <div className="task-title">{ticket.title}</div>
            <div className="task-meta">Assigned to {ticket.assigned_to}</div>
            <div className="task-updates">
              {ticket.updates.map((u, i) => (
                <div key={i} className="task-update">
                  <strong>{u.author}</strong>: {u.content}{" "}
                  <small>{new Date(u.date).toLocaleDateString()}</small>
                </div>
              ))}
            </div>
            <div className="task-controls">
              <input
                placeholder="Write comment..."
                value={ticket.draft || ""}
                onChange={e => onDraftChange(ticket.id, e.target.value)}
                className="task-input"
              />
              <button
                onClick={() => onSend(ticket.id)}
                className={`btn primary ${!ticket.draft ? "opacity-50 cursor-not-allowed" : ""}`}
                disabled={!ticket.draft}
              >
                Send
              </button>
              {ticket.tier !== "completed" && (
                <button onClick={() => onMove(ticket.id, "completed")} className="btn success">Complete</button>
              )}
              {ticket.tier === "current" && (
                <button onClick={() => onMove(ticket.id, "next")} className="btn warning">Backlog</button>
              )}
              {ticket.tier === "next" && (
                <button onClick={() => onMove(ticket.id, "current")} className="btn info">Escalate</button>
              )}
            </div>
          </div>
        ))
      )}
    </div>
  );
}

function Dashboard() {
  const [tickets, setTickets] = useState([]);
  const [loading, setLoading] = useState(true);
  const [newTicket, setNewTicket] = useState({ title: "", assigned_to: "Disney" });
  const [notification, setNotification] = useState("");

  useEffect(() => {
    fetchTickets();
  }, []);

  async function fetchTickets() {
    setLoading(true);
    const { data, error } = await supabase
      .from("tickets")
      .select("*")
      .order("created", { ascending: true });
    if (!error) setTickets(data.map(t => ({ ...t, draft: "" })));
    setLoading(false);
  }

  async function createTicket() {
    if (!newTicket.title) return;
    await supabase.from("tickets").insert([
      {
        ...newTicket,
        created_by: "You",
        created: new Date().toISOString(),
        tier: "next",
        updates: []
      }
    ]);
    setNewTicket({ title: "", assigned_to: "Disney" });
    notify("Ticket created");
    fetchTickets();
  }

  async function sendComment(id) {
    const ticket = tickets.find(t => t.id === id);
    const update = { author: "You", content: ticket.draft, date: new Date().toISOString() };
    await supabase
      .from("tickets")
      .update({ updates: [...ticket.updates, update] })
      .eq("id", id);
    notify("Comment sent");
    fetchTickets();
  }

  async function moveTier(id, tier) {
    const ticket = tickets.find(t => t.id === id);
    const update = { author: "You", content: `Moved to ${tier}`, date: new Date().toISOString() };
    await supabase
      .from("tickets")
      .update({ tier, updates: [...ticket.updates, update] })
      .eq("id", id);
    notify("Ticket moved");
    fetchTickets();
  }

  function notify(msg) {
    setNotification(msg);
    setTimeout(() => setNotification(""), 2000);
  }

  return (
    <div className="container">
      <header className="header">
        <h1 className="app-title">Ticket Tracker</h1>
        <div className="flex items-center gap-4">
          <button
            onClick={async () => {
              await supabase.auth.signOut();
              window.location.href = "/login";
            }}
            className="bg-red-600 text-white px-4 py-2 rounded-lg hover:bg-red-700"
          >
            Logout
          </button>
        </div>
      </header>

      {notification && <div className="notification">{notification}</div>}

      <section className="new-task-form">
        <h2>New Ticket</h2>
        <input
          placeholder="Title"
          value={newTicket.title}
          onChange={e => setNewTicket({ ...newTicket, title: e.target.value })}
          className="task-input wide"
        />
        <input
          placeholder="Assign to"
          value={newTicket.assigned_to}
          disabled
          className="task-input narrow opacity-50"
        />
        <button onClick={createTicket} className="btn primary">Add Ticket</button>
      </section>

      {loading ? (
        <p className="loading">Loading tickets…</p>
      ) : (
        <>
          <TierSection
            title="Current"
            tickets={tickets.filter(t => t.tier === "current")}
            onMove={moveTier}
            onDraftChange={(id, text) => setTickets(ts => ts.map(t => (t.id === id ? { ...t, draft: text } : t)))}
            onSend={sendComment}
          />
          <TierSection
            title="Next Up"
            tickets={tickets.filter(t => t.tier === "next")}
            onMove={moveTier}
            onDraftChange={(id, text) => setTickets(ts => ts.map(t => (t.id === id ? { ...t, draft: text } : t)))}
            onSend={sendComment}
          />
          <TierSection
            title="Completed"
            tickets={tickets.filter(t => t.tier === "completed")}
            onMove={() => {}}
            onDraftChange={(id, text) => setTickets(ts => ts.map(t => (t.id === id ? { ...t, draft: text } : t)))}
            onSend={sendComment}
          />
        </>
      )}
    </div>
  );
}

export default Dashboard;
