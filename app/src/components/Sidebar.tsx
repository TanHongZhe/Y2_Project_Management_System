'use client';

import React from 'react';
import { useQuery, useMutation } from 'convex/react';
import { api } from '../../convex/_generated/api';
import * as Icons from './Icons';

type Route = string;

interface SidebarProps {
  route: Route;
  setRoute: (r: Route) => void;
  selectedThreadId: string | null;
  onSelectThread: (id: string | null) => void;
}

const PROJECT = {
  id: "Y2-PMS-001",
  name: "Solar Bus Demonstrator",
  course: "ENG2-SYS",
  semester: "Spring 26",
};

export default function Sidebar({ route, setRoute, selectedThreadId, onSelectThread }: SidebarProps) {
  const stats = useQuery(api.overview.stats, {});
  const threads = useQuery(api.threads.list, { limit: 20 });
  const createThread = useMutation(api.threads.create);

  const counts = stats?.counts ?? { components: 0, decisions: 0, tests: 0, memoryNotes: 0, documents: 0 };
  const budget = stats?.budget ?? { spent: 0, committed: 0, cap: 60, pct: 0 };
  const pct = Math.min(1, budget.pct);

  async function handleNewSession() {
    const id = await createThread({ title: "New session" });
    onSelectThread(String(id));
  }

  const navItems = [
    { id: "memory",     label: "Project Memory",  Icon: Icons.Memory, count: String(counts.memoryNotes || "") },
    { id: "decisions",  label: "Decisions",        Icon: Icons.Gavel,  count: String(counts.decisions || "") },
    { id: "components", label: "Components",       Icon: Icons.Chip,   count: String(counts.components || "") },
    { id: "tests",      label: "Test Results",     Icon: Icons.Wave,   count: String(counts.tests || "") },
    { id: "docs",       label: "Docs",             Icon: Icons.Folder, count: String(counts.documents || "") },
  ];

  return (
    <aside className="sidebar">
      <div className="sidebar-header">
        <span className="project-id">{PROJECT.id}</span>
        <span className="project-name">{PROJECT.name}</span>
        <div className="project-meta">
          <span>{PROJECT.course}</span>
          <span>·</span>
          <span>{PROJECT.semester}</span>
        </div>
      </div>

      <div className="sidebar-nav">
        <div className="sidebar-section">Workspace</div>

        <div
          className={"nav-item" + (route === "overview" ? " active" : "")}
          onClick={() => setRoute("overview")}
        >
          <Icons.Dash />
          <span>Overview</span>
        </div>

        {/* Chat + inline thread list */}
        <div
          className={"nav-item" + (route === "chat" ? " active" : "")}
          onClick={() => setRoute("chat")}
          style={{ justifyContent: "space-between" }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <Icons.Chat />
            <span>Chat</span>
          </div>
          <button
            className="btn ghost icon-only"
            style={{ width: 20, height: 20, padding: 0, flexShrink: 0 }}
            title="New session"
            onClick={(e) => { e.stopPropagation(); void handleNewSession(); }}
          >
            <Icons.Plus size={12} />
          </button>
        </div>

        {threads && threads.length > 0 && (
          <div className="thread-list" style={{ marginLeft: 16, borderLeft: "1px solid var(--line)", marginBottom: 2 }}>
            {threads.map(t => (
              <div
                key={t._id}
                className={"nav-item" + (selectedThreadId === t._id && route === "chat" ? " active" : "")}
                style={{ paddingLeft: 12, fontSize: 12, minHeight: 28 }}
                onClick={() => onSelectThread(t._id)}
              >
                <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", flex: 1 }}>
                  {t.title}
                </span>
              </div>
            ))}
          </div>
        )}

        {navItems.map(it => (
          <div
            key={it.id}
            className={"nav-item" + (route === it.id ? " active" : "")}
            onClick={() => setRoute(it.id)}
          >
            <it.Icon />
            <span>{it.label}</span>
            <span className="count">{it.count}</span>
          </div>
        ))}

        <div className="budget-card">
          <div className="label">
            <span>Budget</span>
            <span>{Math.round(pct * 100)}%</span>
          </div>
          <div className="value">
            <span>£{(budget.committed ?? budget.spent).toFixed(2)}</span>
            <span className="of">/ £{budget.cap.toFixed(2)}</span>
          </div>
          <div className="budget-bar"><span style={{ width: `${pct * 100}%` }} /></div>
        </div>
      </div>{/* end sidebar-nav */}

      <div className="sidebar-footer">
        <div
          className={"nav-item" + (route === "settings" ? " active" : "")}
          onClick={() => setRoute("settings")}
        >
          <Icons.Cog /><span>Settings</span>
        </div>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "8px 12px 4px" }}>
          <span className="status-pill"><span className="dot" />Connected</span>
          <span className="status-pill" style={{ color: "var(--text-faint)" }}>v0.4.0</span>
        </div>
      </div>
    </aside>
  );
}
