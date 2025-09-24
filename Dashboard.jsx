import React, { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import "./App.css";

const ACTION_OPTIONS = [
  { value: "submit-document", label: "Submit a document" },
  { value: "sign-off", label: "Sign off on completion" },
  { value: "add-approvers", label: "Assign approvers" },
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
    isCompleted: false,
    completedAt: null,
    signOffDetails: null,
    documentSubmissions: [],
    approverInvites: []
  };
}

function normalizeAction(action, priority) {
  const actionTypes = Array.isArray(action.actionTypes) && action.actionTypes.length > 0
    ? action.actionTypes
    : [ACTION_OPTIONS[0].value];
  return {
    ...action,
    actionTypes,
    priority: typeof action.priority === "number" ? action.priority : priority,
    isCompleted: Boolean(action.isCompleted),
    completedAt: action.completedAt ?? null,
    signOffDetails: action.signOffDetails ?? null,
    documentSubmissions: Array.isArray(action.documentSubmissions) ? action.documentSubmissions : [],
    approverInvites: Array.isArray(action.approverInvites) ? action.approverInvites : []
  };
}

function getInitialActions() {
  const stored = typeof window !== "undefined" ? window.localStorage.getItem(STORAGE_KEY) : null;
  if (stored) {
    try {
      const parsed = JSON.parse(stored);
      if (Array.isArray(parsed)) {
        return parsed.map((item, index) => normalizeAction(item, index));
      }
    } catch (err) {
      console.error("Failed to read stored actions", err);
    }
  }
  return [
    {
      id: crypto.randomUUID(),
      title: "Submit the integration packet",
      description:
        "Bundle the final drawings, safety analysis, and vendor sign-offs, then upload them to the shared workspace.",
      actionTypes: ["submit-document", "add-approvers"],
      priority: 0,
      isCompleted: false,
      completedAt: null,
      signOffDetails: null,
      documentSubmissions: [],
      approverInvites: []
    },
    {
      id: crypto.randomUUID(),
      title: "Circulate completion sign-off",
      description:
        "Confirm that the hand-off checklist is complete and route it for signatures from operations and QA.",
      actionTypes: ["sign-off", "review"],
      priority: 1,
      isCompleted: false,
      completedAt: null,
      signOffDetails: null,
      documentSubmissions: [],
      approverInvites: []
    },
    {
      id: crypto.randomUUID(),
      title: "Invite additional approvers",
      description: "Loop in procurement for the parts order so they can add their approval criteria.",
      actionTypes: ["add-approvers"],
      priority: 2,
      isCompleted: false,
      completedAt: null,
      signOffDetails: null,
      documentSubmissions: [],
      approverInvites: []
    }
  ];
}

function Dashboard() {
  const navigate = useNavigate();
  const [actions, setActions] = useState(() => getInitialActions());
  const [isEditing, setIsEditing] = useState(false);
  const [draggedId, setDraggedId] = useState(null);
  const [newAction, setNewAction] = useState(() => createBlankAction(0));
  const [dialog, setDialog] = useState(null);
  const [signOffForm, setSignOffForm] = useState({ name: "" });
  const [documentForm, setDocumentForm] = useState({ fileName: "", comment: "" });
  const [approverForm, setApproverForm] = useState({ fullName: "", email: "", message: "" });

  useEffect(() => {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(actions));
  }, [actions]);

  const awaitingApproval = useMemo(
    () =>
      actions
        .filter(action => !action.isCompleted && action.approverInvites && action.approverInvites.length > 0)
        .sort((a, b) => a.priority - b.priority),
    [actions]
  );

  const openActions = useMemo(
    () =>
      actions
        .filter(action => !action.isCompleted && (!action.approverInvites || action.approverInvites.length === 0))
        .sort((a, b) => a.priority - b.priority),
    [actions]
  );

  const completedActions = useMemo(
    () => actions.filter(action => action.isCompleted).sort((a, b) => a.priority - b.priority),
    [actions]
  );

  function updateAction(id, updater) {
    setActions(prev => {
      const updated = prev.map(action => (action.id === id ? normalizeAction({ ...action, ...updater(action) }, action.priority) : action));
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
      const updated = prev.map(action => {
        if (action.id !== id) return action;
        const nextCompleted = !action.isCompleted;
        return {
          ...action,
          isCompleted: nextCompleted,
          completedAt: nextCompleted ? new Date().toISOString() : null
        };
      });
      return syncPriorities(updated);
    });
  }

  function handleActionTypeToggle(id, value) {
    updateAction(id, action => {
      const hasValue = action.actionTypes.includes(value);
      const nextTypes = hasValue
        ? action.actionTypes.filter(type => type !== value)
        : [...action.actionTypes, value];
      if (nextTypes.length === 0) {
        return { actionTypes: action.actionTypes };
      }
      return { actionTypes: nextTypes };
    });
  }

  function handleDragStart(id) {
    setDraggedId(id);
  }

  function handleDragEnter(targetId) {
    if (!draggedId || draggedId === targetId) return;
    setActions(prev => {
      const openList = prev
        .filter(action => !action.isCompleted && (!action.approverInvites || action.approverInvites.length === 0))
        .sort((a, b) => a.priority - b.priority);
      const draggedIndex = openList.findIndex(action => action.id === draggedId);
      const targetIndex = openList.findIndex(action => action.id === targetId);
      if (draggedIndex === -1 || targetIndex === -1) {
        return prev;
      }
      const reordered = [...openList];
      const [removed] = reordered.splice(draggedIndex, 1);
      reordered.splice(targetIndex, 0, removed);
      const awaitingList = prev
        .filter(action => !action.isCompleted && action.approverInvites && action.approverInvites.length > 0)
        .sort((a, b) => a.priority - b.priority);
      const completedList = prev.filter(action => action.isCompleted).sort((a, b) => a.priority - b.priority);
      const recombined = [...reordered, ...awaitingList, ...completedList];
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
        isCompleted: false,
        completedAt: null,
        signOffDetails: null,
        documentSubmissions: [],
        approverInvites: []
      };
      return [...prev, actionToAdd];
    });
    setNewAction(createBlankAction(0));
  }

  function handleNewActionTypeToggle(value) {
    setNewAction(prev => {
      const hasValue = prev.actionTypes.includes(value);
      const nextTypes = hasValue ? prev.actionTypes.filter(type => type !== value) : [...prev.actionTypes, value];
      if (nextTypes.length === 0) {
        return prev;
      }
      return {
        ...prev,
        actionTypes: nextTypes
      };
    });
  }

  function closeDialog() {
    setDialog(null);
    setSignOffForm({ name: "" });
    setDocumentForm({ fileName: "", comment: "" });
    setApproverForm({ fullName: "", email: "", message: "" });
  }

  const dialogAction = useMemo(
    () => (dialog ? actions.find(action => action.id === dialog.actionId) ?? null : null),
    [actions, dialog]
  );

  function handlePrimaryAction(action, forcedType) {
    const primaryType = forcedType ?? action.actionTypes[0];
    if (primaryType === "sign-off") {
      setDialog({ type: "sign-off", actionId: action.id });
      return;
    }
    if (primaryType === "submit-document") {
      setDialog({ type: "submit-document", actionId: action.id });
      return;
    }
    if (primaryType === "add-approvers") {
      setDialog({ type: "add-approvers", actionId: action.id });
      return;
    }
    handleToggleComplete(action.id);
  }

  function handleSignOffSubmit(event) {
    event.preventDefault();
    if (!dialog || dialog.type !== "sign-off") return;
    if (!signOffForm.name.trim()) {
      return;
    }
    const timestamp = new Date().toISOString();
    updateAction(dialog.actionId, () => ({
      isCompleted: true,
      completedAt: timestamp,
      signOffDetails: {
        signer: signOffForm.name.trim(),
        signedAt: timestamp
      }
    }));
    closeDialog();
  }

  function handleDocumentSubmit(event) {
    event.preventDefault();
    if (!dialog || dialog.type !== "submit-document") return;
    if (!documentForm.fileName.trim()) {
      return;
    }
    const timestamp = new Date().toISOString();
    updateAction(dialog.actionId, action => ({
      documentSubmissions: [
        {
          id: crypto.randomUUID(),
          fileName: documentForm.fileName.trim(),
          comment: documentForm.comment.trim(),
          submittedAt: timestamp
        },
        ...action.documentSubmissions
      ]
    }));
    closeDialog();
  }

  function handleApproverSubmit(event) {
    event.preventDefault();
    if (!dialog || dialog.type !== "add-approvers") return;
    if (!approverForm.fullName.trim() || !approverForm.email.trim()) {
      return;
    }
    const timestamp = new Date().toISOString();
    updateAction(dialog.actionId, action => ({
      approverInvites: [
        {
          id: crypto.randomUUID(),
          fullName: approverForm.fullName.trim(),
          email: approverForm.email.trim(),
          message: approverForm.message.trim(),
          sentAt: timestamp
        },
        ...action.approverInvites
      ]
    }));
    closeDialog();
  }

  const primaryActionLabel = action => {
    const label = ACTION_OPTIONS.find(option => option.value === action.actionTypes[0]);
    return label ? label.label : "Take action";
  };

  function renderPrimaryButton(action) {
    const primaryType = action.actionTypes[0];
    if (primaryType === "sign-off") {
      return (
        <button className="primary-action" type="button" onClick={() => handlePrimaryAction(action)}>
          Start e-sign
        </button>
      );
    }
    if (primaryType === "submit-document") {
      return (
        <button className="primary-action" type="button" onClick={() => handlePrimaryAction(action)}>
          Upload supporting document
        </button>
      );
    }
    if (primaryType === "add-approvers") {
      return (
        <button className="primary-action" type="button" onClick={() => handlePrimaryAction(action)}>
          Assign approvers
        </button>
      );
    }
    return (
      <button className="primary-action" type="button" onClick={() => handlePrimaryAction(action)}>
        {primaryActionLabel(action)}
      </button>
    );
  }

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
                    {action.documentSubmissions.length > 0 && action.documentSubmissions[0] && (
                      <div className="action-footnote">
                        <p>
                          Last upload: <strong>{action.documentSubmissions[0].fileName}</strong>
                        </p>
                        {action.documentSubmissions[0].submittedAt && (
                          <p className="muted">
                            {new Date(action.documentSubmissions[0].submittedAt).toLocaleString()}
                          </p>
                        )}
                        {action.documentSubmissions[0].comment && (
                          <p className="muted">“{action.documentSubmissions[0].comment}”</p>
                        )}
                      </div>
                    )}
                    {renderPrimaryButton(action)}
                  </div>
                )}
              </article>
            ))
          )}
        </section>
        {awaitingApproval.length > 0 && (
          <section className="awaiting-column">
            <h3>Awaiting approval</h3>
            <div className="awaiting-grid">
              {awaitingApproval.map(action => (
                <article key={action.id} className="action-card awaiting">
                  <div className="action-content">
                    <h2>{action.title}</h2>
                    <p>{action.description || "Approvals are in progress."}</p>
                    <div className="approver-list">
                      {action.approverInvites.map(invite => (
                        <div key={invite.id} className="approver-pill">
                          <span className="approver-name">{invite.fullName}</span>
                          <span className="approver-email">{invite.email}</span>
                          {invite.sentAt && (
                            <span className="approver-date">{new Date(invite.sentAt).toLocaleString()}</span>
                          )}
                          {invite.message && <span className="approver-message">“{invite.message}”</span>}
                        </div>
                      ))}
                    </div>
                    <button
                      className="primary-action"
                      type="button"
                      onClick={() => handlePrimaryAction(action, "add-approvers")}
                    >
                      Add another approver
                    </button>
                  </div>
                </article>
              ))}
            </div>
          </section>
        )}
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
                <button
                  key={action.id}
                  className="completed-pill"
                  type="button"
                  onClick={() => setDialog({ type: "view-completed", actionId: action.id })}
                >
                  ✓ {action.title}
                </button>
              ))}
            </div>
          </section>
        )}
      </div>
      {dialog && (
        <div className="modal-backdrop" role="dialog" aria-modal="true">
          <div className="modal-card">
            <button className="modal-close" type="button" onClick={closeDialog} aria-label="Close dialog">
              ×
            </button>
            {dialog.type === "sign-off" && (
              <form className="modal-form" onSubmit={handleSignOffSubmit}>
                <h2>E-sign completion</h2>
                <p className="muted">Add your signature to close the ticket.</p>
                <label className="modal-field">
                  <span>Signer full name</span>
                  <input
                    value={signOffForm.name}
                    onChange={event => setSignOffForm({ name: event.target.value })}
                    className="modal-input"
                    placeholder="Alex Rivera"
                  />
                </label>
                <div className="modal-actions">
                  <button type="button" className="ghost-btn" onClick={closeDialog}>
                    Cancel
                  </button>
                  <button type="submit" className="primary-action">
                    Sign and close
                  </button>
                </div>
              </form>
            )}
            {dialog.type === "submit-document" && (
              <form className="modal-form" onSubmit={handleDocumentSubmit}>
                <h2>Upload document</h2>
                <p className="muted">Attach the latest file and leave a note for reviewers.</p>
                <label className="modal-field">
                  <span>Choose file</span>
                  <input
                    type="file"
                    className="modal-input file"
                    onChange={event => {
                      const file = event.target.files && event.target.files[0];
                      setDocumentForm(prev => ({ ...prev, fileName: file ? file.name : "" }));
                    }}
                  />
                  {documentForm.fileName && <span className="file-name">Selected: {documentForm.fileName}</span>}
                </label>
                <label className="modal-field">
                  <span>Comment</span>
                  <textarea
                    className="modal-input textarea"
                    value={documentForm.comment}
                    onChange={event => setDocumentForm(prev => ({ ...prev, comment: event.target.value }))}
                    placeholder="Outline what changed or what to review."
                  />
                </label>
                <div className="modal-actions">
                  <button type="button" className="ghost-btn" onClick={closeDialog}>
                    Cancel
                  </button>
                  <button type="submit" className="primary-action">
                    Submit document
                  </button>
                </div>
              </form>
            )}
            {dialog.type === "add-approvers" && (
              <form className="modal-form" onSubmit={handleApproverSubmit}>
                <h2>Assign approvers</h2>
                <p className="muted">Send the request to teammates who need to weigh in.</p>
                <label className="modal-field">
                  <span>Full name</span>
                  <input
                    value={approverForm.fullName}
                    onChange={event => setApproverForm(prev => ({ ...prev, fullName: event.target.value }))}
                    className="modal-input"
                    placeholder="Jordan Lee"
                  />
                </label>
                <label className="modal-field">
                  <span>Email</span>
                  <input
                    type="email"
                    value={approverForm.email}
                    onChange={event => setApproverForm(prev => ({ ...prev, email: event.target.value }))}
                    className="modal-input"
                    placeholder="jordan@example.com"
                  />
                </label>
                <label className="modal-field">
                  <span>Message</span>
                  <textarea
                    className="modal-input textarea"
                    value={approverForm.message}
                    onChange={event => setApproverForm(prev => ({ ...prev, message: event.target.value }))}
                    placeholder="Share the context and what needs their approval."
                  />
                </label>
                <div className="modal-actions">
                  <button type="button" className="ghost-btn" onClick={closeDialog}>
                    Cancel
                  </button>
                  <button type="submit" className="primary-action">
                    Send request
                  </button>
                </div>
              </form>
            )}
            {dialog.type === "view-completed" && dialogAction && (
              <div className="modal-details">
                <div className="details-header">
                  <h2>{dialogAction.title}</h2>
                  <p className="muted">
                    Completed {dialogAction.completedAt ? new Date(dialogAction.completedAt).toLocaleString() : "—"}
                  </p>
                  <div className="chip-row">
                    {dialogAction.actionTypes.map(type => {
                      const option = ACTION_OPTIONS.find(opt => opt.value === type);
                      return (
                        <span key={type} className="action-chip">
                          {option ? option.label : type}
                        </span>
                      );
                    })}
                  </div>
                </div>
                <section className="detail-section">
                  <h3>Summary</h3>
                  <p>{dialogAction.description || "No description provided."}</p>
                </section>
                {dialogAction.signOffDetails && (
                  <section className="detail-section">
                    <h3>Sign-off</h3>
                    <div className="detail-card">
                      <p>
                        Signed by <strong>{dialogAction.signOffDetails.signer}</strong>
                      </p>
                      {dialogAction.signOffDetails.signedAt && (
                        <span className="muted">
                          {new Date(dialogAction.signOffDetails.signedAt).toLocaleString()}
                        </span>
                      )}
                    </div>
                  </section>
                )}
                {dialogAction.documentSubmissions.length > 0 && (
                  <section className="detail-section">
                    <h3>Documents</h3>
                    <div className="detail-stack">
                      {dialogAction.documentSubmissions.map(submission => (
                        <div key={submission.id} className="detail-card">
                          <p>
                            <strong>{submission.fileName}</strong>
                          </p>
                          {submission.submittedAt && (
                            <span className="muted">{new Date(submission.submittedAt).toLocaleString()}</span>
                          )}
                          {submission.comment && <p className="muted">“{submission.comment}”</p>}
                        </div>
                      ))}
                    </div>
                  </section>
                )}
                {dialogAction.approverInvites.length > 0 && (
                  <section className="detail-section">
                    <h3>Approvals</h3>
                    <div className="detail-stack">
                      {dialogAction.approverInvites.map(invite => (
                        <div key={invite.id} className="detail-card">
                          <p>
                            <strong>{invite.fullName}</strong>
                          </p>
                          <span className="muted">{invite.email}</span>
                          {invite.sentAt && <span className="muted">Sent {new Date(invite.sentAt).toLocaleString()}</span>}
                          {invite.message && <p className="muted">“{invite.message}”</p>}
                        </div>
                      ))}
                    </div>
                  </section>
                )}
                <div className="modal-actions">
                  <button type="button" className="ghost-btn" onClick={closeDialog}>
                    Close
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

export default Dashboard;
