'use client';

import React, { useState, useEffect, useRef, useMemo } from 'react';
import { useQuery } from 'convex/react';
import { api } from '../../convex/_generated/api';
import * as Icons from './Icons';

const NAV_ITEMS = [
  { label: "Overview",           route: "overview",    icon: "Dash" },
  { label: "Chat",               route: "chat",        icon: "Chat" },
  { label: "Project Memory",     route: "memory",      icon: "Memory" },
  { label: "Images",             route: "images",      icon: "Image" },
  { label: "Component Register", route: "components",  icon: "Chip" },
  { label: "Test Results",       route: "tests",       icon: "Wave" },
  { label: "Docs",               route: "docs",        icon: "Folder" },
  { label: "Settings",           route: "settings",    icon: "More" },
] as const;

type NavRoute = typeof NAV_ITEMS[number]["route"];

interface Props {
  onClose: () => void;
  onNavigate: (route: NavRoute | string) => void;
  currentRoute: string;
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

export default function CommandPalette({ onClose, onNavigate, currentRoute }: Props) {
  const [query, setQuery] = useState("");
  const [cursor, setCursor] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);

  const memoryNotes = useQuery(api.memoryNotes.list, {});
  const components = useQuery(api.components.list, { limit: 500 });

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  type Result =
    | { kind: "nav"; label: string; route: string; icon: string }
    | { kind: "memory"; section: string }
    | { kind: "component"; name: string; ref: string; model?: string };

  const results: Result[] = useMemo(() => {
    const q = query.toLowerCase().trim();

    if (!q) {
      return NAV_ITEMS.map(n => ({ kind: "nav" as const, label: n.label, route: n.route, icon: n.icon }));
    }

    const out: Result[] = [];

    for (const n of NAV_ITEMS) {
      if (n.label.toLowerCase().includes(q)) {
        out.push({ kind: "nav", label: n.label, route: n.route, icon: n.icon });
      }
    }

    for (const m of memoryNotes ?? []) {
      if (m.section.toLowerCase().includes(q) || m.content.toLowerCase().includes(q)) {
        out.push({ kind: "memory", section: m.section });
      }
    }

    for (const c of components ?? []) {
      if (
        c.name.toLowerCase().includes(q) ||
        (c.model ?? "").toLowerCase().includes(q) ||
        (c.supplier ?? "").toLowerCase().includes(q) ||
        c.ref.toLowerCase().includes(q)
      ) {
        out.push({ kind: "component", name: c.name, ref: c.ref, model: c.model ?? undefined });
      }
    }

    return out.slice(0, 12);
  }, [query, memoryNotes, components]);

  useEffect(() => {
    setCursor(0);
  }, [query]);

  function select(item: Result) {
    switch (item.kind) {
      case "nav":
        onNavigate(item.route);
        break;
      case "memory":
        onNavigate("memory");
        break;
      case "component":
        onNavigate("components");
        break;
    }
    onClose();
  }

  function onKeyDown(e: React.KeyboardEvent) {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setCursor(c => Math.min(c + 1, results.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setCursor(c => Math.max(c - 1, 0));
    } else if (e.key === "Enter") {
      e.preventDefault();
      if (results[cursor]) select(results[cursor]);
    } else if (e.key === "Escape") {
      onClose();
    }
  }

  useEffect(() => {
    const el = listRef.current?.children[cursor] as HTMLElement | undefined;
    el?.scrollIntoView({ block: "nearest" });
  }, [cursor]);

  function kindLabel(kind: Result["kind"]): string {
    switch (kind) {
      case "nav": return "Navigate";
      case "memory": return "Memory";
      case "component": return "Component";
    }
  }

  return (
    <div className="cmd-overlay" onClick={onClose}>
      <div className="cmd-palette" onClick={e => e.stopPropagation()} onKeyDown={onKeyDown}>
        <div className="cmd-search">
          <Icons.Search />
          <input
            ref={inputRef}
            className="cmd-input"
            placeholder="Search memory, components… or navigate"
            value={query}
            onChange={e => setQuery(e.target.value)}
          />
          <span className="kbd">Esc</span>
        </div>
        <div className="cmd-list" ref={listRef}>
          {results.length === 0 && (
            <div className="cmd-empty">No results</div>
          )}
          {results.map((item, idx) => (
            <div
              key={idx}
              className={"cmd-item" + (idx === cursor ? " cmd-current" : "")}
              onMouseEnter={() => setCursor(idx)}
              onClick={() => select(item)}
            >
              <span className="cmd-kind">{kindLabel(item.kind)}</span>
              {item.kind === "nav" && (
                <>
                  <span className="cmd-icon"><NavIcon icon={item.icon} /></span>
                  <span className="cmd-label">{item.label}</span>
                  {item.route === currentRoute && <span className="cmd-current">current</span>}
                </>
              )}
              {item.kind === "memory" && (
                <span className="cmd-label">{item.section}</span>
              )}
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
        </div>
      </div>
    </div>
  );
}
