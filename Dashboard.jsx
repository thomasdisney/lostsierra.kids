import React, { useState, useEffect } from "react";
import { createClient } from "@supabase/supabase-js";
import { useNavigate } from "react-router-dom";
import "./App.css";

const supabase = createClient(
  import.meta.env.VITE_SUPABASE_URL,
  import.meta.env.VITE_SUPABASE_ANON_KEY
);

function LoginModal({ onClose, onLogin }) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");

  async function handleLogin(e) {
    e.preventDefault();
    setError("");
    try {
      const { error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) {
        setError(error.message);
      } else {
        onLogin();
        onClose();
      }
    } catch (err) {
      setError("An unexpected error occurred");
      console.error(err);
    }
  }

  return (
    <div className="fixed inset-0 bg-black bg-opacity-70 flex items-center justify-center z-50">
      <div className="bg-gray-900 p-6 border border-gray-700 w-full max-w-sm">
        <h2 className="text-2xl font-bold text-gray-200 mb-4 uppercase tracking-wide">Login to Comment</h2>
        <form onSubmit={handleLogin} className="flex flex-col gap-4">
          <input
            type="email"
            placeholder="Email"
            value={email}
            onChange={e => setEmail(e.target.value)}
            className="task-input"
          />
          <input
            type="password"
            placeholder="Password"
            value={password}
            onChange={e => setPassword(e.target.value)}
            className="task-input"
          />
          <button type="submit" className="btn primary">Login</button>
          {error && <p className="text-red-500 text-sm">{error}</p>}
        </form>
        <button
          onClick={onClose}
          className="mt-4 text-blue-500 hover:underline"
        >
          Cancel
        </button>
      </div>
    </div>
  );
}

function TierSection({ title, tickets, onMove, onDraftChange, onSend, onDelete, isAdmin, isLoggedIn, userId, showLoginModal }) {
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
                onClick={() => (isLoggedIn ? onSend(ticket.id) : showLoginModal())}
                className={`btn primary ${!ticket.draft ? "opacity-50 cursor-not-allowed" : ""}`}
                disabled={!ticket.draft}
              >
                Send
              </button>
              {isAdmin && ticket.tier !== "completed" && (
                <button onClick={() => onMove(ticket.id, "completed")} className="btn success">Complete</button>
              )}
              {isAdmin && ticket.tier === "current" && (
                <button onClick={() => onMove(ticket.id, "next")} className="btn warning">Backlog</button>
              )}
              {isAdmin && ticket.tier === "next" && (
                <button onClick={() => onMove(ticket.id, "current")} className="btn info">Escalate</button>
              )}
              {isAdmin && (
                <button onClick={() => onDelete(ticket.id)} className="btn bg-red-600 hover:bg-red-700">Delete</button>
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
  const [isAdmin, setIsAdmin] = useState(false);
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [userId, setUserId] = useState(null);
  const [showLogin, setShowLogin] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    async function fetchUser() {
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        setUserId(user.id);
        setIsLoggedIn(true);
        const { data, error } = await supabase
          .from("users")
          .select("is_admin")
          .eq("id", user.id)
          .single();
        if (!error && data) setIsAdmin(data.is_admin);
      }
    }
    fetchUser();
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
        created_by: userId || "anonymous",
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
    const update = { author: userId, content: ticket.draft, date: new Date().toISOString() };
    await supabase
      .from("tickets")
      .update({ updates: [...ticket.updates, update] })
      .eq("id", id);
    notify("Comment sent");
    fetchTickets();
  }

  async function moveTier(id, tier) {
    const ticket = tickets.find(t => t.id === id);
    const update = { author: userId, content: `Moved to ${tier}`, date: new Date().toISOString() };
    await supabase
      .from("tickets")
      .update({ tier, updates: [...ticket.updates, update] })
      .eq("id", id);
    notify("Ticket moved");
    fetchTickets();
  }

  async function deleteTicket(id) {
    await supabase
      .from("tickets")
      .delete()
      .eq("id", id);
    notify("Ticket deleted");
    fetchTickets();
  }

  function notify(msg) {
    setNotification(msg);
    setTimeout(() => setNotification(""), 2000);
  }

  return (
    <div className="container">
      {showLogin && (
        <LoginModal
          onClose={() => setShowLogin(false)}
          onLogin={() => {
            setIsLoggedIn(true);
            fetchUser();
          }}
        />
      )}
      <header className="header">
        <button
          onClick={() => navigate("/")}
          className="text-blue-500 hover:underline mr-4"
        >
          Back
        </button>
        <h1 className="app-title">Ticket Tracker</h1>
        <div className="flex items-center gap-4">
          {isLoggedIn ? (
            <button
              onClick={async () => {
                await supabase.auth.signOut();
                setIsLoggedIn(false);
                setUserId(null);
                setIsAdmin(false);
                navigate("/");
              }}
              className="bg-red-600 text-gray-200 px-4 py-2 rounded-none border border-gray-700 hover:bg-red-700"
            >
              Logout
            </button>
          ) : (
            <button
              onClick={() => setShowLogin(true)}
              className="bg-blue-600 text-gray-200 px-4 py-2 rounded-none border border-gray-700 hover:bg-blue-700"
            >
              Login
            </button>
          )}
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
            onDelete={deleteTicket}
            isAdmin={isAdmin}
            isLoggedIn={isLoggedIn}
            userId={userId}
            showLoginModal={() => setShowLogin(true)}
          />
          <TierSection
            title="Next Up"
            tickets={tickets.filter(t => t.tier === "next")}
            onMove={moveTier}
            onDraftChange={(id, text) => setTickets(ts => ts.map(t => (t.id === id ? { ...t, draft: text } : t)))}
            onSend={sendComment}
            onDelete={deleteTicket}
            isAdmin={isAdmin}
            isLoggedIn={isLoggedIn}
            userId={userId}
            showLoginModal={() => setShowLogin(true)}
          />
          <TierSection
            title="Completed"
            tickets={tickets.filter(t => t.tier === "completed")}
            onMove={() => {}}
            onDraftChange={(id, text) => setTickets(ts => ts.map(t => (t.id === id ? { ...t, draft: text } : t)))}
            onSend={sendComment}
            onDelete={deleteTicket}
            isAdmin={isAdmin}
            isLoggedIn={isLoggedIn}
            userId={userId}
            showLoginModal={() => setShowLogin(true)}
          />
        </>
      )}
    </div>
  );
}

export default Dashboard;
