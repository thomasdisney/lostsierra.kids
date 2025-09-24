import React, { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import "./App.css";

const ACTION_OPTIONS = [
  { value: "submit-document", label: "Submit a document" },
  { value: "sign-off", label: "Sign off on completion" },
  { value: "add-approvers", label: "Add approvers" },
  { value: "review", label: "Review progress" }
];

const STORAGE_KEY = "tomdisney-open-actions";

function createBlankAction(priority) {
  return {
    id: crypto.randomUUID(),
    title: "Untitled action",
    description: "",
    actionTypes: [ACTION_OPTIONS[0].value],
    priority,
    isCompleted: false
  };
}

function getInitialActions() {
  const stored = typeof window !== "undefined" ? window.localStorage.getItem(STORAGE_KEY) : null;
  if (stored) {
    try {
      const parsed = JSON.parse(stored);
      if (Array.isArray(parsed)) {
        return parsed;
      }
    } catch (err) {
      console.error("Failed to read stored actions", err);
    }
  }
  return [
    {
      id: crypto.randomUUID(),
      title: "Submit the integration packet",
      description: "Bundle the final drawings, safety analysis, and vendor sign-offs, then upload them to the shared workspace.",
      actionTypes: ["submit-document", "add-approvers"],
      priority: 0,
      isCompleted: false
    },
    {
      id: crypto.randomUUID(),
      title: "Circulate completion sign-off",
      description: "Confirm that the hand-off checklist is complete and route it for signatures from operations and QA.",
      actionTypes: ["sign-off", "review"],
      priority: 1,
      isCompleted: false
    },
    {
      id: crypto.randomUUID(),
      title: "Invite additional approvers",
      description: "Loop in procurement for the parts order so they can add their approval criteria.",
      actionTypes: ["add-approvers"],
      priority: 2,
      isCompleted: false
    }
  ];
}

function Dashboard() {
  const navigate = useNavigate();
  const [actions, setActions] = useState(() => getInitialActions());
  const [isEditing, setIsEditing] = useState(false);
  const [draggedId, setDraggedId] = useState(null);
  const [newAction, setNewAction] = useState(() => createBlankAction(0));

  useEffect(() => {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(actions));
  }, [actions]);

  const openActions = useMemo(() => actions.filter(action => !action.isCompleted).sort((a, b) => a.priority - b.priority), [actions]);
  const completedActions = useMemo(
    () => actions.filter(action => action.isCompleted).sort((a, b) => a.priority - b.priority),
    [actions]
  );

  function updateAction(id, updater) {
    setActions(prev => {
      const updated = prev.map(action => (action.id === id ? { ...action, ...updater(action) } : action));
      return syncPriorities(updated);
    });
  }

  function syncPriorities(list) {
    const sorted = [...list].sort((a, b) => a.priority - b.priority);
    const open = sorted.filter(a => !a.isCompleted);
    const completed = sorted.filter(a => a.isCompleted);
    const remapped = [
      ...open.map((action, index) => ({ ...action, priority: index })),
      ...completed.map((action, index) => ({ ...action, priority: open.length + index }))
    ];
    remapped.sort((a, b) => a.priority - b.priority);
    return remapped;
  }

  function handleToggleComplete(id) {
    setActions(prev => {
      const updated = prev.map(action => (action.id === id ? { ...action, isCompleted: !action.isCompleted } : action));
      return syncPriorities(updated);
    });
  }

  function handleActionTypeToggle(id, value) {
    updateAction(id, action => {
      const hasValue = action.actionTypes.includes(value);
      return {
        actionTypes: hasValue
          ? action.actionTypes.filter(type => type !== value)
          : [...action.actionTypes, value]
      };
    });
  }

  function handleDragStart(id) {
    setDraggedId(id);
  }

  function handleDragEnter(targetId) {
    if (!draggedId || draggedId === targetId) return;
    setActions(prev => {
      const openList = prev.filter(action => !action.isCompleted).sort((a, b) => a.priority - b.priority);
      const draggedIndex = openList.findIndex(action => action.id === draggedId);
      const targetIndex = openList.findIndex(action => action.id === targetId);
      if (draggedIndex === -1 || targetIndex === -1) {
        return prev;
      }
      const reordered = [...openList];
      const [removed] = reordered.splice(draggedIndex, 1);
      reordered.splice(targetIndex, 0, removed);
      const completedList = prev.filter(action => action.isCompleted).sort((a, b) => a.priority - b.priority);
      const recombined = [...reordered, ...completedList];
      return recombined.map((action, index) => ({ ...action, priority: index }));
    });
  }

  function handleDragEnd() {
    setDraggedId(null);
  }

  function handleAddAction() {
    if (!newAction.title.trim()) {
      return;
    }
    setActions(prev => {
      const nextPriority = prev.filter(action => !action.isCompleted).length;
      const actionToAdd = {
        ...newAction,
        id: crypto.randomUUID(),
        priority: nextPriority,
        isCompleted: false
      };
      return [...prev, actionToAdd];
    });
    setNewAction(createBlankAction(0));
  }

  function handleNewActionTypeToggle(value) {
    setNewAction(prev => {
      const hasValue = prev.actionTypes.includes(value);
      return {
        ...prev,
        actionTypes: hasValue ? prev.actionTypes.filter(type => type !== value) : [...prev.actionTypes, value]
      };
    });
  }

  const primaryActionLabel = action => {
    const label = ACTION_OPTIONS.find(option => option.value === action.actionTypes[0]);
    return label ? label.label : "Take action";
  };

  return (
    <div className="dashboard-shell">
      <button className="edit-toggle" onClick={() => setIsEditing(prev => !prev)} aria-label="Toggle editing">
        <span className={`edit-toggle-dot ${isEditing ? "active" : ""}`} />
      </button>
      <div className="actions-wrapper">
        <header className="actions-header">
          <button onClick={() => navigate("/")} className="back-link" type="button">
            ← back
          </button>
          <div>
            <h1>Action hub</h1>
            <p>Prioritize the next moves and glide each action to done.</p>
          </div>
        </header>
        <section className="priority-column" aria-live="polite">
          {openActions.length === 0 ? (
            <div className="empty-state">
              <h2>All actions are complete</h2>
              <p>Take a breather or add what comes next.</p>
            </div>
          ) : (
            openActions.map(action => (
              <article
                key={action.id}
                className={`action-card ${draggedId === action.id ? "dragging" : ""}`}
                draggable={isEditing}
                onDragStart={() => handleDragStart(action.id)}
                onDragOver={event => {
                  event.preventDefault();
                  if (isEditing) {
                    handleDragEnter(action.id);
                  }
                }}
                onDragEnd={handleDragEnd}
              >
                <div className="action-meta">
                  <span className="priority-pill">Priority {openActions.findIndex(item => item.id === action.id) + 1}</span>
                  {!isEditing && (
                    <button className="complete-btn" onClick={() => handleToggleComplete(action.id)} type="button">
                      Mark complete
                    </button>
                  )}
                </div>
                {isEditing ? (
                  <div className="action-editable">
                    <input
                      value={action.title}
                      onChange={event => updateAction(action.id, () => ({ title: event.target.value }))}
                      className="action-input title"
                      placeholder="Action title"
                    />
                    <textarea
                      value={action.description}
                      onChange={event => updateAction(action.id, () => ({ description: event.target.value }))}
                      className="action-input description"
                      placeholder="Describe the next move"
                    />
                    <div className="checkbox-grid">
                      {ACTION_OPTIONS.map(option => (
                        <label key={option.value} className="checkbox-chip">
                          <input
                            type="checkbox"
                            checked={action.actionTypes.includes(option.value)}
                            onChange={() => handleActionTypeToggle(action.id, option.value)}
                          />
                          <span>{option.label}</span>
                        </label>
                      ))}
                    </div>
                  </div>
                ) : (
                  <div className="action-content">
                    <h2>{action.title}</h2>
                    <p>{action.description || "Add a description so everyone knows the objective."}</p>
                    <div className="chip-row">
                      {action.actionTypes.map(type => {
                        const option = ACTION_OPTIONS.find(opt => opt.value === type);
                        return (
                          <span key={type} className="action-chip">
                            {option ? option.label : type}
                          </span>
                        );
                      })}
                    </div>
                    <button className="primary-action" type="button" onClick={() => handleToggleComplete(action.id)}>
                      {primaryActionLabel(action)}
                    </button>
                  </div>
                )}
              </article>
            ))
          )}
        </section>
        {isEditing && (
          <section className="new-action-panel">
            <h3>Add a new action</h3>
            <div className="new-action-grid">
              <input
                className="action-input title"
                value={newAction.title}
                onChange={event => setNewAction(prev => ({ ...prev, title: event.target.value }))}
                placeholder="Action title"
              />
              <textarea
                className="action-input description"
                value={newAction.description}
                onChange={event => setNewAction(prev => ({ ...prev, description: event.target.value }))}
                placeholder="What needs to happen?"
              />
            </div>
            <div className="checkbox-grid">
              {ACTION_OPTIONS.map(option => (
                <label key={option.value} className="checkbox-chip">
                  <input
                    type="checkbox"
                    checked={newAction.actionTypes.includes(option.value)}
                    onChange={() => handleNewActionTypeToggle(option.value)}
                  />
                  <span>{option.label}</span>
                </label>
              ))}
            </div>
            <button className="add-action-btn" type="button" onClick={handleAddAction}>
              Add to queue
            </button>
          </section>
        )}
        {completedActions.length > 0 && (
          <section className="completed-column">
            <h3>Recently completed</h3>
            <div className="completed-grid">
              {completedActions.map(action => (
                <button key={action.id} className="completed-pill" type="button" onClick={() => handleToggleComplete(action.id)}>
                  ✓ {action.title}
                </button>
              ))}
            </div>
          </section>
        )}
      </div>
    </div>
  );
}

export default Dashboard;
