'use client';

import React from 'react';
import { AppData } from '@/lib/data';
import * as Icons from './Icons';

type Route = string;

interface SidebarProps {
  route: Route;
  setRoute: (r: Route) => void;
  data: AppData;
}

export default function Sidebar({ route, setRoute, data }: SidebarProps) {
  const items = [
    { id: "overview",   label: "Overview",        Icon: Icons.Dash,   count: "" },
    { id: "chat",       label: "Chat",            Icon: Icons.Chat,   count: "12" },
    { id: "memory",     label: "Project Memory",  Icon: Icons.Memory, count: "7" },
    { id: "decisions",  label: "Decisions",       Icon: Icons.Gavel,  count: "10" },
    { id: "components", label: "Components",      Icon: Icons.Chip,   count: "12" },
    { id: "tests",      label: "Test Results",    Icon: Icons.Wave,   count: "21" },
    { id: "docs",       label: "Docs",            Icon: Icons.Folder, count: "16" },
  ];

  const spent = data.components.reduce((s, c) => c.status !== "planned" ? s + c.cost : s, 0);
  const pct = Math.min(1, spent / data.project.budgetCap);

  return (
    <aside className="sidebar">
      <div className="sidebar-header">
        <span className="project-id">{data.project.id}</span>
        <span className="project-name">{data.project.name}</span>
        <div className="project-meta">
          <span>{data.project.course}</span>
          <span>·</span>
          <span>{data.project.semester}</span>
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
          <span>£{spent.toFixed(2)}</span>
          <span className="of">/ £{data.project.budgetCap.toFixed(2)}</span>
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
          <span className="status-pill" style={{ color: "var(--text-faint)" }}>v0.3.1</span>
        </div>
      </div>
    </aside>
  );
}
