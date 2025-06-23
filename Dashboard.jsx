import React, { useState, useEffect } from "react";
import { createClient } from "@supabase/supabase-js";
import "./App.css";

const supabase = createClient(
  import.meta.env.VITE_SUPABASE_URL,
  import.meta.env.VITE_SUPABASE_ANON_KEY
);

function TierSection({ title, tasks, onMove, onDraftChange, onPost }) {
  return (
    <div className="tier-section">
      <h2 className="tier-title">
        {title} ({tasks.length})
      </h2>
      {tasks.length === 0 ? (
        <p className="tier-empty">No tasks here.</p>
      ) : (
        tasks.map(task => (
          <div key={task.id} className={`task-card ${task.tier === "completed" ? "completed" : ""}`}>
            <div className="task-title">{task.title}</div>
            <div className="task-meta">Assigned to {task.assigned_to}</div>
            <div className="task-updates">
              {task.updates.map((u, i) => (
                <div key={i} className="task-update">
                  <strong>{u.author}</strong>: {u.content}{" "}
                  <small>{new Date(u.date).toLocaleDateString()}</small>
                </div>
              ))}
            </div>
            <div className="task-controls">
              <input
                placeholder="Write comment..."
                value={task.draft || ""}
                onChange={e => onDraftChange(task.id, e.target.value)}
                className="task-input"
              />
              <button onClick={() => onPost(task.id)} className="btn primary">Post</button>
              {task.tier !== "completed" && (
                <button onClick={() => onMove(task.id, "completed")} className="btn success">Complete</button>
              )}
              {task.tier === "current" && (
                <button onClick={() => onMove(task.id, "next")} className="btn warning">Backlog</button>
              )}
              {task.tier === "next" && (
                <button onClick={() => onMove(task.id, "current")} className="btn info">Escalate</button>
              )}
            </div>
          </div>
        ))
      )}
    </div>
  );
}

function Dashboard() {
  const [projects, setProjects] = useState([]);
  const [activeProjectId, setActiveProjectId] = useState(null);
  const [tasks, setTasks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [newTask, setNewTask] = useState({ title: "", assigned_to: "" });
  const [newProjectName, setNewProjectName] = useState("");
  const [notification, setNotification] = useState("");

  useEffect(() => {
    fetchProjects();
  }, []);

  useEffect(() => {
    if (activeProjectId) fetchTasks();
  }, [activeProjectId]);

  async function fetchProjects() {
    const { data, error } = await supabase.from("projects").select("*").order("created_at", { ascending: true });
    if (!error) {
      setProjects(data);
      if (data.length > 0) setActiveProjectId(data[0].id);
    }
  }

  async function fetchTasks() {
    setLoading(true);
    const { data, error } = await supabase
      .from("tasks")
      .select("*")
      .eq("project", activeProjectId)
      .order("created", { ascending: true });
    if (!error) setTasks(data.map(t => ({ ...t, draft: "" })));
    setLoading(false);
  }

  async function createProject() {
    if (!newProjectName) return;
    const { data, error } = await supabase.from("projects").insert([{ name: newProjectName }]).select();
    if (!error && data.length > 0) {
      setProjects(p => [...p, data[0]]);
      setActiveProjectId(data[0].id);
      setNewProjectName("");
      notify("Project created");
    }
  }

  async function createTask() {
    if (!newTask.title || !newTask.assigned_to || !activeProjectId) return;
    await supabase.from("tasks").insert([
      {
        ...newTask,
        project: activeProjectId,
        created_by: "You",
        created: new Date().toISOString(),
        tier: "next",
        updates: [],
      },
    ]);
    setNewTask({ title: "", assigned_to: "" });
    notify("Task created");
    fetchTasks();
  }

  async function postComment(id) {
    const task = tasks.find(t => t.id === id);
    const update = { author: "You", content: task.draft, date: new Date().toISOString() };
    await supabase
      .from("tasks")
      .update({ updates: [...task.updates, update] })
      .eq("id", id);
    notify("Comment posted");
    fetchTasks();
  }

  async function moveTier(id, tier) {
    const task = tasks.find(t => t.id === id);
    const update = { author: "You", content: `Moved to ${tier}`, date: new Date().toISOString() };
    await supabase
      .from("tasks")
      .update({ tier, updates: [...task.updates, update] })
      .eq("id", id);
    notify("Task moved");
    fetchTasks();
  }

  function notify(msg) {
    setNotification(msg);
    setTimeout(() => setNotification(""), 2000);
  }

  return (
    <div className="container">
      <header className="header">
        <h1 className="app-title">Project Tracker</h1>
        <select
          value={activeProjectId || ""}
          onChange={e => setActiveProjectId(e.target.value)}
          className="project-select"
        >
          {projects.map(p => (
            <option key={p.id} value={p.id}>
              {p.name}
            </option>
          ))}
        </select>
      </header>

      <section className="new-task-form">
        <h2>New Project</h2>
        <input
          placeholder="Project name"
          value={newProjectName}
          onChange={e => setNewProjectName(e.target.value)}
          className="task-input wide"
        />
        <button onClick={createProject} className="btn info">
          Create Project
        </button>
      </section>

      {notification && <div className="notification">{notification}</div>}

      <section className="new-task-form">
        <h2>New Task</h2>
        <input
          placeholder="Title"
          value={newTask.title}
          onChange={e => setNewTask({ ...newTask, title: e.target.value })}
          className="task-input wide"
        />
        <input
          placeholder="Assign to"
          value={newTask.assigned_to}
          onChange={e => setNewTask({ ...newTask, assigned_to: e.target.value })}
          className="task-input narrow"
        />
        <button onClick={createTask} className="btn primary">
          Add Task
        </button>
      </section>

      {loading ? (
        <p className="loading">Loading tasks…</p>
      ) : (
        <>
          <TierSection
            title="Current"
            tasks={tasks.filter(t => t.tier === "current")}
            onMove={moveTier}
            onDraftChange={(id, text) => setTasks(ts => ts.map(t => (t.id === id ? { ...t, draft: text } : t)))}
            onPost={postComment}
          />
          <TierSection
            title="Next Up"
            tasks={tasks.filter(t => t.tier === "next")}
            onMove={moveTier}
            onDraftChange={(id, text) => setTasks(ts => ts.map(t => (t.id === id ? { ...t, draft: text } : t)))}
            onPost={postComment}
          />
          <TierSection
            title="Completed"
            tasks={tasks.filter(t => t.tier === "completed")}
            onMove={() => {}}
            onDraftChange={(id, text) => setTasks(ts => ts.map(t => (t.id === id ? { ...t, draft: text } : t)))}
            onPost={postComment}
          />
        </>
      )}
    </div>
  );
}

export default Dashboard;
