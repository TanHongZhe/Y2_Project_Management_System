'use client';

import React, { useState, useRef, useMemo, useEffect, useLayoutEffect } from 'react';
import { useQuery, useMutation } from 'convex/react';
import { api } from '../../../convex/_generated/api';
import type { Id } from '../../../convex/_generated/dataModel';
import * as Icons from '../Icons';
import { USERS, AppUser } from '../../lib/users';
import { useToast } from '../Toast';

interface CalendarProps {
  currentUser: AppUser;
  searchBar?: React.ReactNode;
}

// Visible range: 18 May – 18 June 2026.
const RANGE_START = new Date(2026, 4, 18).getTime();
const RANGE_END = new Date(2026, 5, 18).getTime();
const DAY_MS = 86_400_000;
const TOTAL_DAYS = Math.round((RANGE_END - RANGE_START) / DAY_MS) + 1;

const DAY_WIDTH = 28;
const LABEL_WIDTH = 280;
const ROW_HEIGHT = 38;

const MILESTONE_COLOR = 'oklch(0.62 0.18 25)';

const BAR_COLORS = [
  { id: 'green',  value: 'oklch(0.68 0.14 155)' },
  { id: 'amber',  value: 'oklch(0.72 0.14 70)'  },
  { id: 'blue',   value: 'oklch(0.62 0.16 240)' },
  { id: 'pink',   value: 'oklch(0.68 0.18 0)'   },
  { id: 'purple', value: 'oklch(0.62 0.18 305)' },
  { id: 'red',    value: MILESTONE_COLOR        },
];
const DEFAULT_COLOR = BAR_COLORS[0].value;

function startOfDay(ts: number): number {
  const d = new Date(ts);
  d.setHours(0, 0, 0, 0);
  return d.getTime();
}

function fmtMonth(d: Date): string {
  return d.toLocaleString('en-GB', { month: 'short' });
}

function fmtDateInput(ts?: number): string {
  if (ts == null) return '';
  const d = new Date(ts);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

interface CalEvent {
  _id: Id<"calendarEvents">;
  text: string;
  done: boolean;
  assignedTo: string[];
  startDate: number;
  dueDate: number;
  color?: string;
}

type DragKind = 'move' | 'resize-left' | 'resize-right';
interface DragState {
  kind: DragKind;
  eventId: Id<"calendarEvents">;
  startX: number;
  origStart: number;
  origEnd: number;
  moved: boolean;
}

export default function Calendar({ currentUser, searchBar }: CalendarProps) {
  /* eslint-disable @typescript-eslint/no-explicit-any */
  const events = useQuery((api as any).calendarEvents.list, {}) as CalEvent[] | undefined;
  const addEvent = useMutation((api as any).calendarEvents.add);
  const removeEvent = useMutation((api as any).calendarEvents.remove);
  const setText = useMutation((api as any).calendarEvents.setText);
  const setDateRange = useMutation((api as any).calendarEvents.setDateRange);
  const setColorMut = useMutation((api as any).calendarEvents.setColor);
  const setAssignees = useMutation((api as any).calendarEvents.setAssignees);
  const toggleEvent = useMutation((api as any).calendarEvents.toggle);
  /* eslint-enable @typescript-eslint/no-explicit-any */

  const readOnly = !!currentUser.isGuest;
  const gridRef = useRef<HTMLDivElement>(null);
  const toast = useToast();

  /* Optimistic-delete + 5s undo */
  const [pendingDeleteIds, setPendingDeleteIds] = useState<Set<string>>(new Set());
  const pendingDeleteTimers = useRef<Map<string, ReturnType<typeof setTimeout>>>(new Map());
  useEffect(() => {
    return () => {
      pendingDeleteTimers.current.forEach((t) => clearTimeout(t));
      pendingDeleteTimers.current.clear();
    };
  }, []);

  /* Day cells */
  const days = useMemo(() => {
    const out: { ts: number; date: Date; isWeekend: boolean }[] = [];
    for (let i = 0; i < TOTAL_DAYS; i++) {
      const ts = RANGE_START + i * DAY_MS;
      const date = new Date(ts);
      const dow = date.getDay();
      out.push({ ts, date, isWeekend: dow === 0 || dow === 6 });
    }
    return out;
  }, []);

  /* Visible tasks: any event whose [start, due] overlaps the range,
     minus anything optimistically marked-for-delete. */
  const visibleEvents: CalEvent[] = useMemo(() => {
    if (!events) return [];
    return [...events]
      .filter((t) => !pendingDeleteIds.has(String(t._id)))
      .filter((t) => t.dueDate >= RANGE_START && t.startDate <= RANGE_END + DAY_MS - 1)
      .sort((a, b) => {
        if (a.startDate !== b.startDate) return a.startDate - b.startDate;
        return a.text.localeCompare(b.text);
      });
  }, [events, pendingDeleteIds]);

  /* Days that contain a milestone (red) event — for column shading. */
  const milestoneDays = useMemo(() => {
    const set = new Set<number>();
    for (const e of visibleEvents) {
      if (e.color !== MILESTONE_COLOR) continue;
      let cur = startOfDay(e.startDate);
      const end = startOfDay(e.dueDate);
      while (cur <= end) {
        set.add(cur);
        cur += DAY_MS;
      }
    }
    return set;
  }, [visibleEvents]);

  /* Drag state for moving / resizing bars */
  const [drag, setDrag] = useState<DragState | null>(null);
  const [previewPos, setPreviewPos] = useState<{
    id: string;
    start: number;
    end: number;
  } | null>(null);

  useEffect(() => {
    if (!drag) return;
    function onMove(e: MouseEvent) {
      if (!drag) return;
      const dx = e.clientX - drag.startX;
      const dayDelta = Math.round(dx / DAY_WIDTH);
      if (dayDelta !== 0 && !drag.moved) drag.moved = true;
      let s = drag.origStart;
      let en = drag.origEnd;
      if (drag.kind === 'move') {
        s += dayDelta * DAY_MS;
        en += dayDelta * DAY_MS;
      } else if (drag.kind === 'resize-left') {
        s += dayDelta * DAY_MS;
        if (s > en) s = en;
      } else if (drag.kind === 'resize-right') {
        en += dayDelta * DAY_MS;
        if (en < s) en = s;
      }
      setPreviewPos({ id: String(drag.eventId), start: s, end: en });
    }
    function onUp() {
      if (drag && drag.moved && previewPos) {
        setDateRange({
          id: drag.eventId,
          startDate: previewPos.start,
          dueDate: previewPos.end,
        }).catch(console.error);
      }
      setDrag(null);
      setPreviewPos(null);
    }
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
    return () => {
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup', onUp);
    };
  }, [drag, previewPos, setDateRange]);

  function handleBarMouseDown(
    e: React.MouseEvent,
    t: CalEvent,
    kind: DragKind,
  ) {
    if (readOnly) return;
    e.preventDefault();
    e.stopPropagation();
    setDrag({
      kind,
      eventId: t._id,
      startX: e.clientX,
      origStart: startOfDay(t.startDate),
      origEnd: startOfDay(t.dueDate),
      moved: false,
    });
  }

  /* Editor popover — stores anchor rect; popover figures out where to render. */
  const [editorId, setEditorId] = useState<Id<"calendarEvents"> | null>(null);
  const [anchorRect, setAnchorRect] = useState<DOMRect | null>(null);
  const editorEvent = useMemo(
    () => visibleEvents.find((t) => t._id === editorId) ?? null,
    [editorId, visibleEvents],
  );

  function openEditor(e: React.MouseEvent, t: CalEvent) {
    if (drag && drag.moved) return; // suppress click after drag
    const r = (e.currentTarget as HTMLElement).getBoundingClientRect();
    setAnchorRect(r);
    setEditorId(t._id);
  }
  function closeEditor() {
    setEditorId(null);
    setAnchorRect(null);
  }

  /* Add task: insert with default span. */
  async function handleAdd() {
    if (readOnly) return;
    const today = startOfDay(Date.now());
    const s = today >= RANGE_START && today <= RANGE_END ? today : RANGE_START;
    const e = Math.min(s + 3 * DAY_MS, RANGE_END);
    const colorIdx = visibleEvents.length % BAR_COLORS.length;
    await addEvent({
      text: 'New event',
      startDate: s,
      dueDate: e,
      color: BAR_COLORS[colorIdx].value,
      assignedTo: currentUser.isGuest ? [] : [currentUser.id],
    });
    toast.success('Event added');
  }

  /* Click an empty day cell → spawn a 1-day event there. */
  async function handleEmptyCellClick(dayTs: number) {
    if (readOnly) return;
    const colorIdx = visibleEvents.length % BAR_COLORS.length;
    await addEvent({
      text: 'New event',
      startDate: dayTs,
      dueDate: dayTs,
      color: BAR_COLORS[colorIdx].value,
      assignedTo: currentUser.isGuest ? [] : [currentUser.id],
    });
    const dayLabel = new Date(dayTs).toLocaleDateString('en-GB', {
      day: 'numeric',
      month: 'short',
    });
    toast.success(`Event added on ${dayLabel}`);
  }

  function handleDelete(id: Id<"calendarEvents">) {
    const idStr = String(id);
    const target = visibleEvents.find((e) => e._id === id);
    const label = target?.text ?? 'Event';

    setPendingDeleteIds((s) => new Set([...s, idStr]));
    if (editorId === id) closeEditor();

    const timer = setTimeout(() => {
      void removeEvent({ id });
      setPendingDeleteIds((s) => {
        const n = new Set(s);
        n.delete(idStr);
        return n;
      });
      pendingDeleteTimers.current.delete(idStr);
    }, 5000);
    pendingDeleteTimers.current.set(idStr, timer);

    toast.info(`"${label}" deleted`, {
      duration: 5000,
      action: {
        label: 'Undo',
        onClick: () => {
          const t = pendingDeleteTimers.current.get(idStr);
          if (t) {
            clearTimeout(t);
            pendingDeleteTimers.current.delete(idStr);
          }
          setPendingDeleteIds((s) => {
            const n = new Set(s);
            n.delete(idStr);
            return n;
          });
        },
      },
    });
  }

  /* Group day headers by month */
  const monthSpans = useMemo(() => {
    const spans: { label: string; cols: number }[] = [];
    for (const d of days) {
      const lbl = `${fmtMonth(d.date)} ${d.date.getFullYear()}`;
      const last = spans[spans.length - 1];
      if (last && last.label === lbl) last.cols++;
      else spans.push({ label: lbl, cols: 1 });
    }
    return spans;
  }, [days]);

  const gridWidth = LABEL_WIDTH + TOTAL_DAYS * DAY_WIDTH;

  return (
    <>
      <header className="screen-header">
        <div className="title-block">
          <div className="crumb">Workspace · Calendar</div>
          <h1 style={{ fontSize: 18 }}>Calendar</h1>
        </div>
        <div className="actions">
          {searchBar}
          {!readOnly && (
            <button className="btn primary sm" onClick={handleAdd}>
              <Icons.Plus /><span>Add event</span>
            </button>
          )}
        </div>
      </header>

      <div className="body">
        <div className="gantt-wrap">
          <div className="gantt-scroll">
            <div className="gantt" style={{ width: gridWidth }}>
              {/* Month band */}
              <div className="gantt-month-row">
                <div className="gantt-corner" style={{ width: LABEL_WIDTH }} />
                {monthSpans.map((m, i) => (
                  <div
                    key={i}
                    className="gantt-month-cell"
                    style={{ width: m.cols * DAY_WIDTH }}
                  >
                    {m.label}
                  </div>
                ))}
              </div>

              {/* Day-number header */}
              <div className="gantt-day-row">
                <div className="gantt-corner" style={{ width: LABEL_WIDTH }} />
                {days.map((d) => {
                  const isToday = startOfDay(Date.now()) === d.ts;
                  const isMilestone = milestoneDays.has(d.ts);
                  return (
                    <div
                      key={d.ts}
                      className={
                        'gantt-day-cell' +
                        (d.isWeekend ? ' weekend' : '') +
                        (isMilestone ? ' milestone' : '') +
                        (isToday ? ' today' : '')
                      }
                      style={{ width: DAY_WIDTH }}
                      title={d.date.toLocaleDateString('en-GB', {
                        weekday: 'short',
                        day: 'numeric',
                        month: 'short',
                      })}
                    >
                      <div className="gantt-dow">
                        {d.date.toLocaleDateString('en-GB', { weekday: 'narrow' })}
                      </div>
                      <div className="gantt-dom">{d.date.getDate()}</div>
                    </div>
                  );
                })}
              </div>

              {/* Body rows */}
              <div className="gantt-body" ref={gridRef}>
                {visibleEvents.length === 0 && !events && (
                  <div className="gantt-empty">Loading…</div>
                )}
                {visibleEvents.length === 0 && events && (
                  <div className="gantt-empty">
                    No events in this range yet.
                    {!readOnly && (
                      <>
                        {' '}
                        <button
                          className="btn ghost sm"
                          onClick={handleAdd}
                          style={{ marginLeft: 6 }}
                        >
                          <Icons.Plus size={11} />
                          <span>Add the first event</span>
                        </button>
                      </>
                    )}
                  </div>
                )}

                {visibleEvents.map((t, i) => {
                  const live = previewPos && previewPos.id === String(t._id) ? previewPos : null;
                  const startTs = live ? live.start : startOfDay(t.startDate);
                  const endTs = live ? live.end : startOfDay(t.dueDate);
                  const clampedStart = Math.max(RANGE_START, startTs);
                  const clampedEnd = Math.min(RANGE_END, endTs);
                  const overflowL = startTs < RANGE_START;
                  const overflowR = endTs > RANGE_END;
                  const baseLeft =
                    LABEL_WIDTH + ((clampedStart - RANGE_START) / DAY_MS) * DAY_WIDTH;
                  const totalSpan =
                    Math.max(1, (clampedEnd - clampedStart) / DAY_MS + 1) * DAY_WIDTH;
                  // 2px inset on each non-overflowing edge so 1-day bars sit centred in their column.
                  const left = baseLeft + (overflowL ? 0 : 2);
                  const width =
                    totalSpan - (overflowL ? 0 : 2) - (overflowR ? 0 : 2);
                  const color = t.color ?? DEFAULT_COLOR;

                  return (
                    <div
                      key={t._id}
                      className={'gantt-row' + (t.done ? ' done' : '')}
                      style={{ height: ROW_HEIGHT }}
                    >
                      <div className="gantt-label" style={{ width: LABEL_WIDTH }}>
                        <div
                          className={'gantt-checkbox' + (t.done ? ' checked' : '')}
                          onClick={readOnly ? undefined : () => toggleEvent({ id: t._id })}
                          title={t.done ? 'Mark not done' : 'Mark done'}
                        >
                          {t.done && <Icons.Check size={9} stroke="#fff" sw={2.5} />}
                        </div>
                        <span
                          className="gantt-label-text"
                          title={t.text}
                          onClick={(e) => openEditor(e, t)}
                          style={{ cursor: 'pointer' }}
                        >
                          {t.text}
                        </span>
                        {t.assignedTo.length > 0 && (
                          <div className="gantt-label-pips">
                            {t.assignedTo.map((uid) => {
                              const u = USERS.find((x) => x.id === uid);
                              if (!u) return null;
                              return (
                                <span
                                  key={uid}
                                  className="gantt-label-pip"
                                  style={{ background: u.color }}
                                  title={u.name}
                                >
                                  {u.initials}
                                </span>
                              );
                            })}
                          </div>
                        )}
                        {!readOnly && (
                          <button
                            type="button"
                            className="gantt-row-trash"
                            title="Delete event"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleDelete(t._id);
                            }}
                          >
                            <Icons.Trash size={12} />
                          </button>
                        )}
                      </div>

                      {days.map((d) => {
                        const isToday = startOfDay(Date.now()) === d.ts;
                        return (
                          <div
                            key={d.ts}
                            className={
                              'gantt-cell' +
                              (d.isWeekend ? ' weekend' : '') +
                              (milestoneDays.has(d.ts) ? ' milestone' : '') +
                              (isToday ? ' today' : '')
                            }
                            style={{ width: DAY_WIDTH }}
                            onClick={readOnly ? undefined : () => handleEmptyCellClick(d.ts)}
                            title={
                              readOnly
                                ? ''
                                : `Add event on ${d.date.toLocaleDateString('en-GB')}`
                            }
                          />
                        );
                      })}

                      <div
                        className={
                          'gantt-bar' +
                          (overflowL ? ' overflow-l' : '') +
                          (overflowR ? ' overflow-r' : '') +
                          (drag?.eventId === t._id ? ' dragging' : '')
                        }
                        style={{
                          left,
                          width,
                          top: 6,
                          height: ROW_HEIGHT - 12,
                          background: color,
                          cursor: readOnly ? 'pointer' : 'grab',
                          animationDelay: `${i * 45}ms`,
                        }}
                        title={t.text}
                        onMouseDown={(e) => handleBarMouseDown(e, t, 'move')}
                        onClick={(e) => openEditor(e, t)}
                      >
                        {!readOnly && !overflowL && (
                          <div
                            className="gantt-handle left"
                            onMouseDown={(e) => handleBarMouseDown(e, t, 'resize-left')}
                          />
                        )}
                        {!readOnly && !overflowR && (
                          <div
                            className="gantt-handle right"
                            onMouseDown={(e) => handleBarMouseDown(e, t, 'resize-right')}
                          />
                        )}
                      </div>
                    </div>
                  );
                })}

                {!readOnly && visibleEvents.length > 0 && (
                  <div
                    className="gantt-row gantt-row-add"
                    style={{ height: ROW_HEIGHT }}
                    onClick={handleAdd}
                  >
                    <div className="gantt-label" style={{ width: LABEL_WIDTH }}>
                      <Icons.Plus size={11} />
                      <span style={{ marginLeft: 6 }}>Add event</span>
                    </div>
                    {days.map((d) => {
                      const isToday = startOfDay(Date.now()) === d.ts;
                      return (
                        <div
                          key={d.ts}
                          className={
                            'gantt-cell' +
                            (d.isWeekend ? ' weekend' : '') +
                            (milestoneDays.has(d.ts) ? ' milestone' : '') +
                            (isToday ? ' today' : '')
                          }
                          style={{ width: DAY_WIDTH }}
                        />
                      );
                    })}
                  </div>
                )}
              </div>
            </div>
          </div>

        </div>
      </div>

      {editorEvent && anchorRect && (
        <EditPopover
          event={editorEvent}
          anchor={anchorRect}
          readOnly={readOnly}
          onClose={closeEditor}
          onText={(v) => setText({ id: editorEvent._id, text: v })}
          onDates={(s, e) =>
            setDateRange({ id: editorEvent._id, startDate: s, dueDate: e })
          }
          onColor={(c) => setColorMut({ id: editorEvent._id, color: c })}
          onAssignees={(arr) =>
            setAssignees({ id: editorEvent._id, assignedTo: arr })
          }
          onDelete={() => handleDelete(editorEvent._id)}
        />
      )}
    </>
  );
}

/* ------------------------------- Editor ------------------------------- */

function EditPopover({
  event,
  anchor,
  readOnly,
  onClose,
  onText,
  onDates,
  onColor,
  onAssignees,
  onDelete,
}: {
  event: CalEvent;
  anchor: DOMRect;
  readOnly: boolean;
  onClose: () => void;
  onText: (v: string) => void;
  onDates: (s: number, e: number) => void;
  onColor: (c: string) => void;
  onAssignees: (arr: string[]) => void;
  onDelete: () => void;
}) {
  const [text, setLocalText] = useState(event.text);
  const [start, setStart] = useState(fmtDateInput(event.startDate));
  const [end, setEnd] = useState(fmtDateInput(event.dueDate));
  const popRef = useRef<HTMLDivElement>(null);
  const [pos, setPos] = useState<{ top: number; left: number; placement: string }>({
    top: anchor.bottom + 6,
    left: anchor.left,
    placement: 'bottom',
  });

  useEffect(() => {
    setLocalText(event.text);
    setStart(fmtDateInput(event.startDate));
    setEnd(fmtDateInput(event.dueDate));
  }, [event._id, event.text, event.startDate, event.dueDate]);

  /* Smart placement: prefer below-right, then below-left, then above-right, then above-left. */
  useLayoutEffect(() => {
    const el = popRef.current;
    if (!el) return;
    const margin = 8;
    const vw = window.innerWidth;
    const vh = window.innerHeight;
    const w = el.offsetWidth;
    const h = el.offsetHeight;

    const spaceBelow = vh - anchor.bottom - margin;
    const spaceAbove = anchor.top - margin;
    const spaceRight = vw - anchor.left - margin;
    const spaceLeft = anchor.right - margin;

    let top: number;
    let placement: string;
    if (spaceBelow >= h || spaceBelow >= spaceAbove) {
      top = anchor.bottom + 6;
      placement = 'bottom';
    } else {
      top = anchor.top - h - 6;
      placement = 'top';
    }
    // Clamp vertically inside viewport.
    if (top + h > vh - margin) top = vh - h - margin;
    if (top < margin) top = margin;

    let left: number;
    if (spaceRight >= w || spaceRight >= spaceLeft) {
      // Align popover's left to anchor's left.
      left = anchor.left;
      placement += '-right';
    } else {
      // Align popover's right to anchor's right.
      left = anchor.right - w;
      placement += '-left';
    }
    // Clamp horizontally inside viewport.
    if (left + w > vw - margin) left = vw - w - margin;
    if (left < margin) left = margin;

    setPos({ top, left, placement });
  }, [anchor.left, anchor.right, anchor.top, anchor.bottom]);

  useEffect(() => {
    function onDown(e: MouseEvent) {
      if (!popRef.current?.contains(e.target as Node)) onClose();
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose();
    }
    document.addEventListener('mousedown', onDown);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDown);
      document.removeEventListener('keydown', onKey);
    };
  }, [onClose]);

  function commitText() {
    const v = text.trim();
    if (v && v !== event.text) onText(v);
  }
  function commitDates(nextStart: string, nextEnd: string) {
    if (!nextStart || !nextEnd) return;
    const s = new Date(nextStart).getTime();
    let en = new Date(nextEnd).getTime();
    if (en < s) en = s;
    onDates(s, en);
  }

  const currentColor = event.color ?? DEFAULT_COLOR;

  return (
    <div
      ref={popRef}
      className="gantt-popover"
      data-placement={pos.placement}
      style={{ position: 'fixed', top: pos.top, left: pos.left }}
      onMouseDown={(e) => e.stopPropagation()}
    >
      <div className="gantt-popover-head">
        <span className="gantt-popover-title">Edit event</span>
        <button
          className="btn ghost icon-only sm"
          onClick={onClose}
          title="Close"
        >
          <Icons.X size={11} />
        </button>
      </div>

      <input
        className="gantt-popover-input"
        value={text}
        disabled={readOnly}
        onChange={(e) => setLocalText(e.target.value)}
        onBlur={commitText}
        onKeyDown={(e) => {
          if (e.key === 'Enter') (e.currentTarget as HTMLInputElement).blur();
        }}
        placeholder="Event name"
      />

      <div className="gantt-popover-row">
        <label>Start</label>
        <input
          type="date"
          value={start}
          disabled={readOnly}
          onChange={(e) => {
            setStart(e.target.value);
            commitDates(e.target.value, end);
          }}
        />
      </div>
      <div className="gantt-popover-row">
        <label>End</label>
        <input
          type="date"
          value={end}
          disabled={readOnly}
          onChange={(e) => {
            setEnd(e.target.value);
            commitDates(start, e.target.value);
          }}
        />
      </div>

      <div className="gantt-popover-row" style={{ alignItems: 'flex-start' }}>
        <label>Colour</label>
        <div className="gantt-color-row">
          {BAR_COLORS.map((c) => (
            <button
              key={c.id}
              type="button"
              disabled={readOnly}
              className={
                'gantt-color-swatch' + (currentColor === c.value ? ' active' : '')
              }
              style={{ background: c.value }}
              onClick={() => onColor(c.value)}
              title={c.id}
            />
          ))}
        </div>
      </div>

      <div className="gantt-popover-row" style={{ alignItems: 'flex-start' }}>
        <label>Assignees</label>
        <div className="gantt-assignee-row">
          {(() => {
            const nonGuests = USERS.filter((u) => !u.isGuest);
            const allPicked = nonGuests.length > 0 && nonGuests.every((u) => event.assignedTo.includes(u.id));
            return (
              <>
                <button
                  type="button"
                  disabled={readOnly}
                  onClick={() => {
                    if (allPicked) {
                      onAssignees([]);
                    } else {
                      onAssignees(nonGuests.map((u) => u.id));
                    }
                  }}
                  className={'gantt-assignee-chip' + (allPicked ? ' picked' : '')}
                  title={allPicked ? 'Deselect all' : 'Select all'}
                  style={{
                    background: allPicked ? 'var(--accent)' : 'transparent',
                    color: allPicked ? '#fff' : 'var(--text)',
                    border: '1px solid ' + (allPicked ? 'var(--accent)' : 'var(--line)'),
                  }}
                >
                  <span style={{ fontWeight: 600 }}>All</span>
                </button>
                {nonGuests.map((u) => {
                  const picked = event.assignedTo.includes(u.id);
                  return (
                    <button
                      key={u.id}
                      type="button"
                      disabled={readOnly}
                      onClick={() => {
                        const next = picked
                          ? event.assignedTo.filter((x) => x !== u.id)
                          : [...event.assignedTo, u.id];
                        onAssignees(next);
                      }}
                      className={'gantt-assignee-chip' + (picked ? ' picked' : '')}
                      title={u.name}
                    >
                      <span
                        className="user-pip sm"
                        style={{ background: u.color, border: 'none' }}
                      >
                        {u.initials}
                      </span>
                      <span>{u.name}</span>
                    </button>
                  );
                })}
              </>
            );
          })()}
        </div>
      </div>

      {!readOnly && (
        <div className="gantt-popover-foot">
          <button className="btn ghost sm" onClick={onDelete}>
            <Icons.Trash size={11} />
            <span>Delete event</span>
          </button>
        </div>
      )}
    </div>
  );
}
