'use client';

import React, { useState, useRef, useEffect, useCallback } from 'react';
import { useQuery, useMutation } from 'convex/react';
import { api } from '../../../convex/_generated/api';
import type { Id } from '../../../convex/_generated/dataModel';
import * as Icons from '../Icons';
import { USERS, AppUser } from '../../lib/users';

interface OverviewProps {
  setRoute: (r: string) => void;
  currentUser: AppUser;
}

const PROJECT_NAME = "Solar Bus Demonstrator";
const DEMO_DAY = new Date("2026-06-18T00:00:00").getTime();
const PROJECT_START = new Date("2026-05-13T00:00:00").getTime();

function relativeTime(ts: number): string {
  const diff = Date.now() - ts;
  const m = Math.floor(diff / 60_000);
  if (m < 1) return "just now";
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  const d = Math.floor(h / 24);
  if (d < 30) return `${d}d ago`;
  return new Date(ts).toISOString().slice(0, 10);
}

function DonutChart({ pct, size = 120, stroke = 18 }: { pct: number; size?: number; stroke?: number }) {
  const r = (size - stroke) / 2;
  const cx = size / 2;
  const cy = size / 2;
  const circ = 2 * Math.PI * r;
  const filled = Math.min(Math.max(pct, 0), 1) * circ;
  const color = pct > 0.9 ? "var(--danger)" : pct > 0.7 ? "var(--warn)" : "var(--accent)";
  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} style={{ transform: "rotate(-90deg)", display: "block" }}>
      <circle cx={cx} cy={cy} r={r} fill="none" stroke="var(--bg-sunk)" strokeWidth={stroke} />
      {filled > 0 && (
        <circle
          cx={cx} cy={cy} r={r}
          fill="none"
          stroke={color}
          strokeWidth={stroke}
          strokeDasharray={`${filled} ${circ - filled}`}
          strokeLinecap="butt"
        />
      )}
    </svg>
  );
}

function AssigneePicker({
  assignedTo,
  onToggle,
}: {
  assignedTo: string[];
  onToggle: (userId: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const [dropPos, setDropPos] = useState({ top: 0, left: 0 });
  const triggerRef = useRef<HTMLDivElement>(null);
  const dropRef = useRef<HTMLDivElement>(null);

  const handleOpen = useCallback(() => {
    if (triggerRef.current) {
      const r = triggerRef.current.getBoundingClientRect();
      setDropPos({ top: r.bottom + 4, left: r.left });
    }
    setOpen(v => !v);
  }, []);

  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      const t = e.target as Node;
      if (
        !triggerRef.current?.contains(t) &&
        !dropRef.current?.contains(t)
      ) setOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [open]);

  return (
    <div className="apicker-wrap" ref={triggerRef}>
      <div className="todo-assignees" onClick={handleOpen} style={{ cursor: "pointer" }}>
        {assignedTo.map(uid => {
          const u = USERS.find(x => x.id === uid);
          if (!u) return null;
          return (
            <div key={uid} className="user-pip" style={{ background: u.color }} title={u.name}>
              {u.initials}
            </div>
          );
        })}
        <div className="user-pip unassigned" title={assignedTo.length === 0 ? "Assign someone" : "Edit assignees"}>
          <Icons.Plus size={9} />
        </div>
      </div>
      {open && (
        <div
          ref={dropRef}
          className="apicker-drop"
          style={{ position: "fixed", top: dropPos.top, left: dropPos.left, zIndex: 9999 }}
        >
          {USERS.map(u => {
            const picked = assignedTo.includes(u.id);
            return (
              <div
                key={u.id}
                className={`apicker-opt${picked ? " picked" : ""}`}
                onClick={() => onToggle(u.id)}
              >
                <div className="user-pip sm" style={{ background: u.color, border: "none" }}>{u.initials}</div>
                <span>{u.name}</span>
                {picked && <Icons.Check size={12} />}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

export default function Overview({ setRoute, currentUser }: OverviewProps) {
  const stats = useQuery(api.overview.stats, {});
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const todos = useQuery((api as any).todos.list, {});
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const addTodo = useMutation((api as any).todos.add);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const toggleTodo = useMutation((api as any).todos.toggle);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const removeTodo = useMutation((api as any).todos.remove);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const setAssignees = useMutation((api as any).todos.setAssignees);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const setDueDate = useMutation((api as any).todos.setDueDate);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const setImportant = useMutation((api as any).todos.setImportant);

  const recentImages = useQuery(api.progressImages.listWithUrls, {});
  const slides = React.useMemo(
    () => (recentImages ?? []).filter(img => img.url).slice(0, 5),
    [recentImages],
  );
  const [slideIdx, setSlideIdx] = useState(0);
  useEffect(() => {
    if (slides.length < 2) return;
    const t = setInterval(() => setSlideIdx(i => (i + 1) % slides.length), 3000);
    return () => clearInterval(t);
  }, [slides.length]);

  const [newTodo, setNewTodo] = useState("");
  const [myTodosOnly, setMyTodosOnly] = useState(false);

  const now = Date.now();
  const daysLeft = Math.max(0, Math.ceil((DEMO_DAY - now) / (1000 * 60 * 60 * 24)));
  const elapsed = Math.min(1, Math.max(0, (now - PROJECT_START) / (DEMO_DAY - PROJECT_START)));

  const handleAddTodo = async () => {
    const text = newTodo.trim();
    if (!text) return;
    setNewTodo("");
    await addTodo({ text });
  };

  const handleToggleAssignee = async (
    todoId: Id<"todos">,
    current: string[],
    userId: string,
  ) => {
    const next = current.includes(userId)
      ? current.filter(x => x !== userId)
      : [...current, userId];
    await setAssignees({ id: todoId, assignedTo: next });
  };

  type TodoItem = { _id: Id<"todos">; text: string; done: boolean; assignedTo: string[]; dueDate?: number; important?: boolean };

  const sortedTodos: TodoItem[] = React.useMemo(() => {
    if (!todos) return [];
    let list: TodoItem[] = [...todos];
    if (myTodosOnly) list = list.filter((t: TodoItem) => t.assignedTo.includes(currentUser.id));
    return list.sort((a, b) => {
      // Done tasks always sink to the bottom
      if (a.done && !b.done) return 1;
      if (!a.done && b.done) return -1;
      // Important items pinned to the top within each group
      if (a.important && !b.important) return -1;
      if (!a.important && b.important) return 1;
      // Within same group, sort by due date
      const aHas = !!a.dueDate, bHas = !!b.dueDate;
      if (aHas && !bHas) return -1;
      if (!aHas && bHas) return 1;
      if (aHas && bHas && a.dueDate !== b.dueDate) return a.dueDate! - b.dueDate!;
      return 0;
    });
  }, [todos, myTodosOnly, currentUser.id]);

  if (!stats) {
    return (
      <>
        <header className="screen-header">
          <div className="title-block">
            <div className="crumb">Workspace · Overview</div>
            <h1>{PROJECT_NAME}</h1>
          </div>
        </header>
        <div className="body">
          <div style={{ padding: 40, color: "var(--text-muted)" }}>Loading…</div>
        </div>
      </>
    );
  }

  const { counts, budget, recentActivity } = stats;
  const doneCount = todos ? todos.filter((t: { done: boolean }) => t.done).length : 0;
  const totalCount = todos ? todos.length : 0;
  const visibleCount = sortedTodos.length;

  return (
    <>
      <header className="screen-header">
        <div className="title-block">
          <div className="crumb">Workspace · Overview</div>
          <h1>{PROJECT_NAME}</h1>
        </div>
        <div className="actions">
          <button className="btn sm" onClick={() => setRoute("chat")}>
            <Icons.Chat /><span>Continue chat</span>
          </button>
          <button className="btn primary sm" onClick={() => setRoute("empty")}>
            <Icons.Plus /><span>New session</span>
          </button>
        </div>
      </header>

      <div className="body">
        <div className="dash">

          <div className="dash-grid-v2">

            {/* Countdown */}
            <div className="card">
              <div className="card-head"><h3>Demo Day</h3></div>
              <div className="countdown-hero">
                <div className="countdown-days">{daysLeft}</div>
                <div className="countdown-unit">days remaining</div>
                <div className="countdown-event">18 June 2026 · ENG2-SYS</div>
                <div className="countdown-progress" style={{ marginTop: 16 }}>
                  <span style={{ width: `${elapsed * 100}%` }} />
                </div>
                <div style={{ display: "flex", justifyContent: "space-between", marginTop: 5 }}>
                  <span className="micro">May 2026</span>
                  <span className="micro">{Math.round(elapsed * 100)}% elapsed</span>
                  <span className="micro">Jun 2026</span>
                </div>
              </div>
            </div>

            {/* Budget donut */}
            <div className="card">
              <div className="card-head"><h3>Budget</h3></div>
              <div className="budget-donut-wrap">
                <div className="budget-donut-chart">
                  <DonutChart pct={budget.pct} size={120} stroke={18} />
                  <div className="budget-donut-center">
                    <div className="budget-donut-pct">{Math.round(budget.pct * 100)}%</div>
                    <div className="budget-donut-used">used</div>
                  </div>
                </div>
                <div className="budget-donut-legend">
                  <div className="bdl-item">
                    <div className="bdl-label">
                      <span className="bdl-dot" style={{ background: "var(--accent)" }} />
                      Committed
                    </div>
                    <div className="bdl-value">£{budget.committed.toFixed(2)}</div>
                  </div>
                  <div className="bdl-item">
                    <div className="bdl-label">
                      <span className="bdl-dot" style={{ background: "var(--bg-sunk)", border: "1.5px solid var(--line-strong)" }} />
                      Remaining
                    </div>
                    <div className="bdl-value">£{budget.remaining.toFixed(2)}</div>
                  </div>
                  <div className="bdl-cap">Cap · £{budget.cap.toFixed(2)}</div>
                </div>
              </div>
            </div>

            {/* Mini project stats */}
            <div className="card">
              <div className="card-head"><h3>Project</h3></div>
              <div className="stat-mini-row">
                <div className="stat-mini">
                  <div className="l">Tests</div>
                  <div className="v">{counts.tests}</div>
                </div>
                <div className="stat-mini">
                  <div className="l">Docs</div>
                  <div className="v">{counts.documents}</div>
                </div>
                <div className="stat-mini">
                  <div className="l">Parts</div>
                  <div className="v">{counts.components}</div>
                </div>
                <div className="stat-mini">
                  <div className="l">Memory</div>
                  <div className="v">{counts.memoryNotes}</div>
                </div>
              </div>
            </div>

            {/* Team todo list */}
            <div className="card span-2" style={{ minHeight: 260 }}>
              <div className="card-head">
                <h3>Team Todo</h3>
                <button
                  className={"chip sm" + (myTodosOnly ? " active" : "")}
                  onClick={() => setMyTodosOnly(v => !v)}
                  style={{ marginLeft: 10, fontSize: 11 }}
                  title="Show only tasks assigned to me"
                >
                  Mine
                </button>
                {totalCount > 0 && (
                  <span className="micro" style={{ marginLeft: "auto" }}>
                    {doneCount}/{totalCount} done
                  </span>
                )}
              </div>
              <div className="todo-scroll">
                {!todos || totalCount === 0 ? (
                  <div style={{ padding: "16px 0", color: "var(--text-faint)", textAlign: "center", fontSize: 12, fontFamily: "var(--font-mono)" }}>
                    No tasks yet — add one below.
                  </div>
                ) : visibleCount === 0 ? (
                  <div style={{ padding: "16px 0", color: "var(--text-faint)", textAlign: "center", fontSize: 12, fontFamily: "var(--font-mono)" }}>
                    No tasks assigned to you.
                  </div>
                ) : (
                  sortedTodos.map((todo) => {
                    const dueDateValue = todo.dueDate
                      ? new Date(todo.dueDate).toISOString().slice(0, 10)
                      : "";
                    const isOverdue = todo.dueDate && !todo.done && todo.dueDate < Date.now();
                    return (
                      <div key={todo._id} className={`todo-item${todo.important ? " important" : ""}`}>
                        <div
                          className={`todo-checkbox${todo.done ? " checked" : ""}`}
                          onClick={currentUser.isGuest ? undefined : () => toggleTodo({ id: todo._id })}
                          style={currentUser.isGuest ? { cursor: "default" } : undefined}
                        >
                          {todo.done && <Icons.Check size={10} stroke="#fff" sw={2.5} />}
                        </div>
                        <div className="todo-body">
                          <div className={`todo-text${todo.done ? " done" : ""}`}>{todo.text}</div>
                          {!currentUser.isGuest && (
                            <AssigneePicker
                              assignedTo={todo.assignedTo}
                              onToggle={(uid) => handleToggleAssignee(todo._id, todo.assignedTo, uid)}
                            />
                          )}
                        </div>
                        {dueDateValue && (
                          <input
                            type="date"
                            value={dueDateValue}
                            readOnly={currentUser.isGuest}
                            onChange={currentUser.isGuest ? undefined : e => {
                              const val = e.target.value;
                              setDueDate({ id: todo._id, dueDate: val ? new Date(val).getTime() : undefined });
                            }}
                            title="Due date"
                            style={{
                              background: "none",
                              border: "1px solid var(--line)",
                              borderRadius: "var(--r-sm)",
                              color: isOverdue ? "var(--danger)" : dueDateValue ? "var(--text-muted)" : "var(--text-faint)",
                              fontFamily: "var(--font-mono)",
                              fontSize: 11,
                              padding: "2px 6px",
                              cursor: currentUser.isGuest ? "default" : "pointer",
                              flexShrink: 0,
                              colorScheme: "dark",
                            }}
                          />
                        )}
                        {!currentUser.isGuest && (
                          <button
                            className={`todo-important-btn${todo.important ? " active" : ""}`}
                            onClick={() => setImportant({ id: todo._id, important: !todo.important })}
                          >
                            {todo.important ? "Important" : "Mark as Important"}
                          </button>
                        )}
                        {todo.important && currentUser.isGuest && (
                          <span className="todo-important-btn active" style={{ pointerEvents: "none" }}>Important</span>
                        )}
                        {!currentUser.isGuest && (
                          <div className="todo-actions">
                            <button
                              className="btn ghost sm icon-only"
                              onClick={() => removeTodo({ id: todo._id })}
                              title="Delete task"
                            >
                              <Icons.X size={11} />
                            </button>
                          </div>
                        )}
                      </div>
                    );
                  })
                )}
              </div>
              {!currentUser.isGuest && (
                <div className="todo-add-row">
                  <input
                    className="todo-add-input"
                    placeholder="Add a task and press Enter…"
                    value={newTodo}
                    onChange={e => setNewTodo(e.target.value)}
                    onKeyDown={e => e.key === "Enter" && handleAddTodo()}
                  />
                  <button className="btn sm" onClick={handleAddTodo} disabled={!newTodo.trim()}>
                    <Icons.Plus size={11} /><span>Add</span>
                  </button>
                </div>
              )}
            </div>

            {/* Quick links */}
            <div className="card">
              <div className="card-head"><h3>Quick links</h3></div>
              <div style={{ display: "grid", gap: 6 }}>
                <button className="btn sm" style={{ justifyContent: "flex-start" }} onClick={() => setRoute("docs")}>
                  <Icons.Folder size={11} /><span>Upload a document</span>
                </button>
                <button className="btn sm" style={{ justifyContent: "flex-start" }} onClick={() => setRoute("chat")}>
                  <Icons.Chat size={11} /><span>Ask the assistant</span>
                </button>
                <button className="btn sm" style={{ justifyContent: "flex-start" }} onClick={() => setRoute("memory")}>
                  <Icons.Memory size={11} /><span>Edit project memory</span>
                </button>
                <button className="btn sm" style={{ justifyContent: "flex-start" }} onClick={() => setRoute("tests")}>
                  <Icons.Wave size={11} /><span>View test results</span>
                </button>
                <button className="btn sm" style={{ justifyContent: "flex-start" }} onClick={() => setRoute("components")}>
                  <Icons.Chip size={11} /><span>Components BOM</span>
                </button>
                <button className="btn sm" style={{ justifyContent: "flex-start" }} onClick={() => setRoute("images")}>
                  <Icons.Image size={11} /><span>Progress photos</span>
                </button>
              </div>
            </div>

            {/* Recent activity */}
            <div className="card span-3" style={{ padding: 0, flexDirection: "row", overflow: "hidden" }}>
              {/* Photo slideshow */}
              <div className="overview-slideshow">
                {slides.length === 0 ? (
                  <div className="slide-empty">No photos yet</div>
                ) : (
                  slides.map((img, i) => (
                    <img
                      key={img._id}
                      src={img.url!}
                      alt={img.caption ?? ""}
                      className={"slide-img" + (i === slideIdx ? " active" : "")}
                    />
                  ))
                )}
                {slides.length > 1 && (
                  <div className="slide-dots">
                    {slides.map((_, i) => (
                      <span key={i} className={"slide-dot" + (i === slideIdx ? " active" : "")} />
                    ))}
                  </div>
                )}
              </div>
              {/* Activity log */}
              <div style={{ flex: 1, display: "flex", flexDirection: "column", padding: "16px 18px", minWidth: 0 }}>
                <div className="card-head">
                  <h3>Recent activity</h3>
                  <span className="micro" style={{ marginLeft: "auto" }}>latest 10</span>
                </div>
                {recentActivity.length === 0 ? (
                  <div style={{ padding: 16, color: "var(--text-muted)", textAlign: "center" }}>
                    No activity yet.
                  </div>
                ) : (
                  <div className="activity">
                    {recentActivity.map((a: { ts: number; who: "ai" | "you"; what: string }, i: number) => (
                      <div key={i} className="act-row">
                        <span className="act-ts">{relativeTime(a.ts)}</span>
                        <span className={"act-who " + a.who}>{a.who === "ai" ? "AI" : "you"}</span>
                        <span>{a.what}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>

          </div>
        </div>
      </div>
    </>
  );
}
