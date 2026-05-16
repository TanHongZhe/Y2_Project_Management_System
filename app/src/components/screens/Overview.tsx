'use client';

import React, { useState, useRef, useEffect, useCallback, useMemo } from 'react';
import { useQuery, useMutation } from 'convex/react';
import { api } from '../../../convex/_generated/api';
import type { Id } from '../../../convex/_generated/dataModel';
import * as Icons from '../Icons';
import { USERS, AppUser } from '../../lib/users';
import { greeting, relativeDate } from '../../lib/uiUtils';

interface OverviewProps {
  setRoute: (r: string) => void;
  currentUser: AppUser;
  searchBar?: React.ReactNode;
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

function useCountUp(target: number, duration = 700): number {
  const [value, setValue] = useState(0);
  useEffect(() => {
    if (target === 0) { setValue(0); return; }
    const start = performance.now();
    let raf: number;
    function tick(now: number) {
      const t = Math.min((now - start) / duration, 1);
      const eased = 1 - Math.pow(1 - t, 3);
      setValue(Math.round(eased * target));
      if (t < 1) raf = requestAnimationFrame(tick);
    }
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [target, duration]);
  return value;
}

function AnimatedNumber({ value }: { value: number }) {
  const display = useCountUp(value);
  return <>{display}</>;
}

function useAnimatedWidth(target: number): number {
  const [width, setWidth] = useState(0);
  useEffect(() => {
    // Double RAF ensures first paint at 0, then transitions to target
    const id1 = requestAnimationFrame(() => {
      const id2 = requestAnimationFrame(() => setWidth(target));
      return () => cancelAnimationFrame(id2);
    });
    return () => cancelAnimationFrame(id1);
  }, [target]);
  return width;
}

function DonutChart({ pct, size = 120, stroke = 18 }: { pct: number; size?: number; stroke?: number }) {
  const r = (size - stroke) / 2;
  const cx = size / 2;
  const cy = size / 2;
  const circ = 2 * Math.PI * r;
  const finalOffset = circ * (1 - Math.min(Math.max(pct, 0), 1));
  const [dashOffset, setDashOffset] = useState(circ);
  useEffect(() => {
    const id1 = requestAnimationFrame(() => {
      const id2 = requestAnimationFrame(() => setDashOffset(finalOffset));
      return () => cancelAnimationFrame(id2);
    });
    return () => cancelAnimationFrame(id1);
  }, [finalOffset]);
  const color = pct > 0.9 ? "var(--danger)" : pct > 0.7 ? "var(--warn)" : "var(--accent)";
  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} style={{ transform: "rotate(-90deg)", display: "block" }}>
      <circle cx={cx} cy={cy} r={r} fill="none" stroke="var(--bg-sunk)" strokeWidth={stroke} />
      <circle
        cx={cx} cy={cy} r={r}
        fill="none"
        stroke={color}
        strokeWidth={stroke}
        strokeDasharray={circ}
        strokeDashoffset={dashOffset}
        strokeLinecap="butt"
        style={{ transition: 'stroke-dashoffset 1s cubic-bezier(0.4, 0, 0.2, 1)' }}
      />
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

export default function Overview({ setRoute, currentUser, searchBar }: OverviewProps) {
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

  const recentTests = useQuery(api.tests.list, { limit: 20 });

  const [newTodo, setNewTodo] = useState("");
  const [myTodosOnly, setMyTodosOnly] = useState(() => {
    try { return localStorage.getItem('pms-filter-mine') === 'true'; } catch { return false; }
  });
  const toggleMine = () => setMyTodosOnly(v => {
    try { localStorage.setItem('pms-filter-mine', String(!v)); } catch {}
    return !v;
  });

  // Drag-to-reorder todos (localStorage persistence)
  const [dragOrder, setDragOrder] = useState<string[]>(() => {
    try { return JSON.parse(localStorage.getItem('pms-todo-order') ?? '[]'); } catch { return []; }
  });
  const dragIdRef = useRef<string | null>(null);

  function handleTodoDragStart(e: React.DragEvent, id: string) {
    dragIdRef.current = id;
    e.dataTransfer.effectAllowed = 'move';
  }
  function handleTodoDragOver(e: React.DragEvent, overId: string) {
    e.preventDefault();
    const fromId = dragIdRef.current;
    if (!fromId || fromId === overId) return;
    const active = sortedTodos.filter(t => !t.done).map(t => t._id as string);
    const fi = active.indexOf(fromId), ti = active.indexOf(overId);
    if (fi === -1 || ti === -1) return;
    const next = [...active];
    next.splice(fi, 1); next.splice(ti, 0, fromId);
    setDragOrder(next);
    try { localStorage.setItem('pms-todo-order', JSON.stringify(next)); } catch {}
  }
  function handleTodoDragEnd() { dragIdRef.current = null; }

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
      // Overdue first
      const now = Date.now();
      const aOver = !a.done && !!a.dueDate && a.dueDate < now;
      const bOver = !b.done && !!b.dueDate && b.dueDate < now;
      if (aOver && !bOver) return -1;
      if (!aOver && bOver) return 1;
      // Important items next
      if (a.important && !b.important) return -1;
      if (!a.important && b.important) return 1;
      // Due date ascending
      const aHas = !!a.dueDate, bHas = !!b.dueDate;
      if (aHas && !bHas) return -1;
      if (!aHas && bHas) return 1;
      if (aHas && bHas && a.dueDate !== b.dueDate) return a.dueDate! - b.dueDate!;
      return 0;
    });
  }, [todos, myTodosOnly, currentUser.id]);

  // Apply drag order to active (non-done) todos
  const displayTodos = useMemo(() => {
    if (!dragOrder.length) return sortedTodos;
    const done = sortedTodos.filter(t => t.done);
    const active = sortedTodos.filter(t => !t.done);
    const orderMap = new Map(dragOrder.map((id, i) => [id, i]));
    const sorted = [...active].sort((a, b) => {
      const ai = orderMap.has(a._id) ? orderMap.get(a._id)! : Infinity;
      const bi = orderMap.has(b._id) ? orderMap.get(b._id)! : Infinity;
      return ai - bi;
    });
    return [...sorted, ...done];
  }, [sortedTodos, dragOrder]);

  // Test sparkline data
  const sparklineTests = useMemo(() => {
    if (!recentTests) return [];
    return [...recentTests].sort((a, b) => a.testedAt - b.testedAt).slice(-10);
  }, [recentTests]);

  const animatedElapsed = useAnimatedWidth(elapsed * 100);
  const animatedBudgetPct = useAnimatedWidth(
    stats ? Math.min(1, stats.budget.pct) * 100 : 0
  );

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
          <div style={{ padding: "28px 32px", display: "flex", flexDirection: "column", gap: 16 }}>
            <div className="skeleton skeleton-title" />
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 14 }}>
              {[1,2,3].map(i => (
                <div key={i} style={{ display: "flex", flexDirection: "column", gap: 10, padding: 16, border: "1px solid var(--line)", borderRadius: 6 }}>
                  <div className="skeleton skeleton-text short" />
                  <div className="skeleton skeleton-block" />
                </div>
              ))}
            </div>
          </div>
        </div>
      </>
    );
  }

  const { counts, budget, recentActivity } = stats;
  const doneCount = todos ? todos.filter((t: { done: boolean }) => t.done).length : 0;
  const totalCount = todos ? todos.length : 0;
  const visibleCount = displayTodos.length;

  return (
    <>
      <header className="screen-header">
        <div className="title-block">
          <div className="crumb">Workspace · Overview</div>
          <h1 style={{ fontSize: 18 }}>{greeting(currentUser.name.split(' ')[0])}</h1>
          <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 2 }}>{PROJECT_NAME}</div>
        </div>
        <div className="actions">
          {searchBar}
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
                  <span style={{ width: `${animatedElapsed}%` }} />
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
                  <div className="v"><AnimatedNumber value={counts.tests} /></div>
                  {sparklineTests.length > 0 && (
                    <div className="sparkline" title="Recent test results (pass/fail)">
                      {sparklineTests.map((t, i) => (
                        <span
                          key={i}
                          className="spark-dot"
                          style={{ background: t.result === 'pass' ? 'var(--accent)' : t.result === 'fail' ? 'var(--danger)' : 'var(--text-faint)' }}
                          title={`${t.result} — ${new Date(t.testedAt).toLocaleDateString()}`}
                        />
                      ))}
                    </div>
                  )}
                </div>
                <div className="stat-mini">
                  <div className="l">Docs</div>
                  <div className="v"><AnimatedNumber value={counts.documents} /></div>
                </div>
                <div className="stat-mini">
                  <div className="l">Parts</div>
                  <div className="v"><AnimatedNumber value={counts.components} /></div>
                </div>
                <div className="stat-mini">
                  <div className="l">Memory</div>
                  <div className="v"><AnimatedNumber value={counts.memoryNotes} /></div>
                </div>
              </div>
            </div>

            {/* Team todo list */}
            <div className="card span-2" style={{ minHeight: 260 }}>
              <div className="card-head">
                <h3>Team Todo</h3>
                <button
                  className={"chip sm" + (myTodosOnly ? " active" : "")}
                  onClick={toggleMine}
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
                  displayTodos.map((todo) => {
                    const rd = todo.dueDate ? relativeDate(todo.dueDate) : null;
                    const isOverdue = !!rd?.isOverdue && !todo.done;
                    return (
                      <div
                        key={todo._id}
                        className={`todo-item${todo.important ? " important" : ""}${isOverdue ? " overdue" : ""}`}
                        draggable={!todo.done && !currentUser.isGuest}
                        onDragStart={e => handleTodoDragStart(e, todo._id)}
                        onDragOver={e => handleTodoDragOver(e, todo._id)}
                        onDragEnd={handleTodoDragEnd}
                        style={{ cursor: todo.done || currentUser.isGuest ? undefined : 'grab' }}>
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
                        {rd && (
                          <span
                            className="todo-due-badge"
                            style={{ color: rd.isOverdue ? 'var(--danger)' : rd.isSoon ? 'var(--accent)' : 'var(--text-muted)' }}
                            title={todo.dueDate ? new Date(todo.dueDate).toLocaleDateString('en-GB') : ''}
                          >
                            {rd.text}
                          </span>
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
                  <div style={{ position: 'relative', flex: 1 }}>
                    <input
                      className="todo-add-input"
                      placeholder="Add a task and press Enter…"
                      value={newTodo}
                      maxLength={150}
                      onChange={e => setNewTodo(e.target.value)}
                      onKeyDown={e => e.key === "Enter" && handleAddTodo()}
                    />
                    {newTodo.length > 60 && (
                      <span style={{
                        position: 'absolute', right: 8, top: '50%', transform: 'translateY(-50%)',
                        fontSize: 10, color: newTodo.length > 120 ? 'var(--danger)' : 'var(--text-faint)',
                        pointerEvents: 'none',
                      }}>{newTodo.length}/150</span>
                    )}
                  </div>
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
