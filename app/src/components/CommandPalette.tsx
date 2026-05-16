'use client';

import React, { useState, useEffect, useRef, useMemo } from 'react';
import { useQuery } from 'convex/react';
import { api } from '../../convex/_generated/api';
import * as Icons from './Icons';

const NAV_ITEMS = [
  { label: "Overview",           route: "overview",    icon: "Dash" },
  { label: "Chat",               route: "chat",        icon: "Chat" },
  { label: "Meetings",           route: "meetings",    icon: "Chat" },
  { label: "Project Memory",     route: "memory",      icon: "Memory" },
  { label: "Calendar",           route: "calendar",    icon: "Calendar" },
  { label: "Images",             route: "images",      icon: "Image" },
  { label: "Component Register", route: "components",  icon: "Chip" },
  { label: "Test Results",       route: "tests",       icon: "Wave" },
  { label: "Docs",               route: "docs",        icon: "Folder" },
  { label: "Settings",           route: "settings",    icon: "More" },
] as const;

type NavRoute = typeof NAV_ITEMS[number]["route"];

const RECENT_KEY = 'pms-recent-routes';
function loadRecent(): string[] {
  try { return JSON.parse(localStorage.getItem(RECENT_KEY) ?? '[]'); } catch { return []; }
}
export function pushRecentRoute(route: string) {
  const prev = loadRecent().filter(r => r !== route);
  const next = [route, ...prev].slice(0, 4);
  try { localStorage.setItem(RECENT_KEY, JSON.stringify(next)); } catch {}
}

interface Props {
  onClose: () => void;
  onNavigate: (route: NavRoute | string) => void;
  currentRoute: string;
  onNewMeeting?: () => void;
  onNewTodo?: () => void;
}

function NavIcon({ icon }: { icon: string }) {
  switch (icon) {
    case "Dash":   return <Icons.Dash size={14} />;
    case "Chat":   return <Icons.Chat size={14} />;
    case "Memory": return <Icons.Memory size={14} />;
    case "Image":  return <Icons.Image size={14} />;
    case "Chip":   return <Icons.Chip size={14} />;
    case "Wave":   return <Icons.Wave size={14} />;
    case "Folder": return <Icons.Folder size={14} />;
    case "More":   return <Icons.More size={14} />;
    default:       return <Icons.File size={14} />;
  }
}

export default function CommandPalette({ onClose, onNavigate, currentRoute, onNewMeeting, onNewTodo }: Props) {
  const [query, setQuery] = useState("");
  const [cursor, setCursor] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const [recent] = useState(() => loadRecent().filter(r => r !== currentRoute).slice(0, 3));

  const memoryNotes = useQuery(api.memoryNotes.list, {});
  const components = useQuery(api.components.list, { limit: 500 });

  useEffect(() => { inputRef.current?.focus(); }, []);

  type Result =
    | { kind: "nav";       label: string; route: string; icon: string; isRecent?: boolean }
    | { kind: "action";    label: string; actionId: string; icon: string }
    | { kind: "memory";    section: string }
    | { kind: "component"; name: string; ref: string; model?: string };

  const results: Result[] = useMemo(() => {
    const q = query.toLowerCase().trim();

    if (!q) {
      const out: Result[] = [];
      // Quick actions first
      if (onNewMeeting) out.push({ kind: "action", label: "New meeting", actionId: "new-meeting", icon: "Chat" });
      if (onNewTodo)    out.push({ kind: "action", label: "New task",    actionId: "new-todo",    icon: "Dash" });
      // Recent screens
      for (const r of recent) {
        const n = NAV_ITEMS.find(i => i.route === r);
        if (n) out.push({ kind: "nav", label: n.label, route: n.route, icon: n.icon, isRecent: true });
      }
      // All nav
      for (const n of NAV_ITEMS) out.push({ kind: "nav", label: n.label, route: n.route, icon: n.icon });
      return out;
    }

    const out: Result[] = [];
    for (const n of NAV_ITEMS) {
      if (n.label.toLowerCase().includes(q)) out.push({ kind: "nav", label: n.label, route: n.route, icon: n.icon });
    }
    for (const m of memoryNotes ?? []) {
      if (m.section.toLowerCase().includes(q) || m.content.toLowerCase().includes(q)) {
        out.push({ kind: "memory", section: m.section });
      }
    }
    for (const c of components ?? []) {
      if ((c.name + (c.model ?? "") + (c.supplier ?? "") + c.ref).toLowerCase().includes(q)) {
        out.push({ kind: "component", name: c.name, ref: c.ref, model: c.model ?? undefined });
      }
    }
    return out.slice(0, 12);
  }, [query, memoryNotes, components, recent, onNewMeeting, onNewTodo]);

  useEffect(() => { setCursor(0); }, [query]);

  function select(item: Result) {
    switch (item.kind) {
      case "nav":       onNavigate(item.route); break;
      case "action":
        if (item.actionId === "new-meeting") onNewMeeting?.();
        if (item.actionId === "new-todo")    onNewTodo?.();
        break;
      case "memory":    onNavigate("memory");     break;
      case "component": onNavigate("components"); break;
    }
    onClose();
  }

  function onKeyDown(e: React.KeyboardEvent) {
    if (e.key === "ArrowDown")  { e.preventDefault(); setCursor(c => Math.min(c + 1, results.length - 1)); }
    else if (e.key === "ArrowUp")   { e.preventDefault(); setCursor(c => Math.max(c - 1, 0)); }
    else if (e.key === "Enter")     { e.preventDefault(); if (results[cursor]) select(results[cursor]); }
    else if (e.key === "Escape")    { onClose(); }
  }

  useEffect(() => {
    const el = listRef.current?.children[cursor] as HTMLElement | undefined;
    el?.scrollIntoView({ block: "nearest" });
  }, [cursor]);

  function kindLabel(item: Result): string {
    if (item.kind === "nav")       return item.isRecent ? "Recent" : "Navigate";
    if (item.kind === "action")    return "Action";
    if (item.kind === "memory")    return "Memory";
    if (item.kind === "component") return "Component";
    return "";
  }

  return (
    <div className="cmd-overlay" onClick={onClose}>
      <div className="cmd-palette" onClick={e => e.stopPropagation()} onKeyDown={onKeyDown}>
        <div className="cmd-search">
          <Icons.Search />
          <input
            ref={inputRef}
            className="cmd-input"
            placeholder="Navigate, search memory, components…"
            value={query}
            onChange={e => setQuery(e.target.value)}
          />
          <span className="kbd">Esc</span>
        </div>
        <div className="cmd-list" ref={listRef}>
          {results.length === 0 && <div className="cmd-empty">No results</div>}
          {results.map((item, idx) => (
            <div
              key={idx}
              className={"cmd-item" + (idx === cursor ? " cmd-current" : "") + (item.kind === "action" ? " cmd-action-item" : "")}
              onMouseEnter={() => setCursor(idx)}
              onClick={() => select(item)}
            >
              <span className="cmd-kind">{kindLabel(item)}</span>
              {item.kind === "nav" && (
                <>
                  <span className="cmd-icon"><NavIcon icon={item.icon} /></span>
                  <span className="cmd-label">{item.label}</span>
                  {item.route === currentRoute && <span style={{ fontSize: 10, color: "var(--text-faint)", marginLeft: "auto" }}>current</span>}
                </>
              )}
              {item.kind === "action" && (
                <>
                  <span className="cmd-icon"><NavIcon icon={item.icon} /></span>
                  <span className="cmd-label">{item.label}</span>
                  <span style={{ fontSize: 10, color: "var(--accent)", marginLeft: "auto" }}>↵</span>
                </>
              )}
              {item.kind === "memory" && <span className="cmd-label">{item.section}</span>}
              {item.kind === "component" && (
                <>
                  <span className="cmd-mono">{item.ref}</span>
                  <span className="cmd-label">{item.name}</span>
                  {item.model && <span className="cmd-sub">{item.model}</span>}
                </>
              )}
            </div>
          ))}
        </div>
        <div className="cmd-footer">
          <span><span className="kbd">↑↓</span> navigate</span>
          <span><span className="kbd">↵</span> open</span>
          <span><span className="kbd">Esc</span> close</span>
          <span style={{ marginLeft: "auto", color: "var(--text-faint)", fontSize: 10 }}>? for shortcuts</span>
        </div>
      </div>
    </div>
  );
}
