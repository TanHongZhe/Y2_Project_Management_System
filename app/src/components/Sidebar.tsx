'use client';

import React from 'react';
import { useQuery } from 'convex/react';
import { api } from '../../convex/_generated/api';
import * as Icons from './Icons';

type Route = string;

interface SidebarProps {
  route: Route;
  setRoute: (r: Route) => void;
}

const PROJECT = {
  id: "Y2-PMS-001",
  name: "Solar Bus Demonstrator",
  course: "ENG2-SYS",
  semester: "Spring 26",
};

export default function Sidebar({ route, setRoute }: SidebarProps) {
  const stats = useQuery(api.overview.stats, {});
  const threadCount = useQuery(api.threads.list, { limit: 100 });

  const counts = stats?.counts ?? {
    components: 0,
    decisions: 0,
    tests: 0,
    memoryNotes: 0,
    documents: 0,
  };
  const budget = stats?.budget ?? { spent: 0, cap: 60, pct: 0 };

  const items = [
    { id: "overview",   label: "Overview",        Icon: Icons.Dash,   count: "" },
    { id: "chat",       label: "Chat",            Icon: Icons.Chat,   count: threadCount ? String(threadCount.length) : "" },
    { id: "memory",     label: "Project Memory",  Icon: Icons.Memory, count: String(counts.memoryNotes || "") },
    { id: "decisions",  label: "Decisions",       Icon: Icons.Gavel,  count: String(counts.decisions || "") },
    { id: "components", label: "Components",      Icon: Icons.Chip,   count: String(counts.components || "") },
    { id: "tests",      label: "Test Results",    Icon: Icons.Wave,   count: String(counts.tests || "") },
    { id: "docs",       label: "Docs",            Icon: Icons.Folder, count: String(counts.documents || "") },
  ];

  const pct = Math.min(1, budget.pct);

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

      <div className="sidebar-section">Workspace</div>
      {items.map(it => (
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

      <div className="sidebar-section">Project</div>
      <div className="budget-card">
        <div className="label">
          <span>Budget</span>
          <span>{Math.round(pct * 100)}%</span>
        </div>
        <div className="value">
          <span>£{budget.spent.toFixed(2)}</span>
          <span className="of">/ £{budget.cap.toFixed(2)}</span>
        </div>
        <div className="budget-bar"><span style={{ width: `${pct * 100}%` }} /></div>
      </div>

      <div
        className={"nav-item" + (route === "empty" ? " active" : "")}
        onClick={() => setRoute("empty")}
        style={{ marginTop: 4 }}
      >
        <Icons.Plus /><span>New session</span>
      </div>

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
