'use client';

import React, { useState } from 'react';
import { useQuery, useMutation } from 'convex/react';
import { api } from '../../convex/_generated/api';
import * as Icons from './Icons';
import { AppUser } from '../lib/users';

function SidebarAvatar({ user }: { user: AppUser }) {
  const [failed, setFailed] = useState(false);
  if (failed) {
    return (
      <div className="sidebar-user-avatar-fallback" style={{ background: user.color }}>
        {user.initials}
      </div>
    );
  }
  return (
    <div className="sidebar-user-avatar" title={user.name}>
      <img src={user.avatarUrl} alt={user.name} onError={() => setFailed(true)} />
    </div>
  );
}

type Route = string;

interface SidebarProps {
  route: Route;
  setRoute: (r: Route) => void;
  selectedThreadId: string | null;
  onSelectThread: (id: string | null) => void;
  isOpen?: boolean;
  onClose?: () => void;
  currentUser: AppUser;
  onSwitchUser: () => void;
  collapsed?: boolean;
  onToggleCollapse?: () => void;
}

const PROJECT = {
  id: "Y2-PMS-001",
  name: "Solar Bus Demonstrator",
  course: "ENG2-SYS",
  semester: "Spring 26",
};

export default function Sidebar({ route, setRoute, selectedThreadId, onSelectThread, isOpen, onClose, currentUser, onSwitchUser, collapsed, onToggleCollapse }: SidebarProps) {
  const stats = useQuery(api.overview.stats, {});
  const threads = useQuery(api.threads.list, { limit: 20, userId: currentUser.id });
  const createThread = useMutation(api.threads.create);

  const counts = stats?.counts ?? { components: 0, tests: 0, memoryNotes: 0, documents: 0 };
  const budget = stats?.budget ?? { spent: 0, committed: 0, cap: 60, pct: 0 };
  const pct = Math.min(1, budget.pct);

  async function handleNewSession() {
    const id = await createThread({ title: "New session", userId: currentUser.id });
    onSelectThread(String(id));
  }

  const navItems = [
    { id: "memory",     label: "Project Memory",  Icon: Icons.Memory, count: String(counts.memoryNotes || "") },
    { id: "meetings",   label: "Meeting Notes",   Icon: Icons.Chat,   count: "" },
    { id: "images",     label: "Images",           Icon: Icons.Image,  count: String((counts as Record<string, number>).images || "") },
    { id: "components", label: "Components",       Icon: Icons.Chip,   count: String(counts.components || "") },
    { id: "tests",      label: "Test Results",     Icon: Icons.Wave,   count: String(counts.tests || "") },
    { id: "docs",       label: "Docs",             Icon: Icons.Folder, count: String(counts.documents || "") },
  ];

  return (
    <aside className={"sidebar" + (isOpen ? " open" : "") + (collapsed ? " collapsed" : "")}>
      <div className="sidebar-header">
        {!collapsed && (
          <>
            <span className="project-id">{PROJECT.id}</span>
            <span className="project-name">{PROJECT.name}</span>
            <div className="project-meta">
              <span>{PROJECT.course}</span>
              <span>·</span>
              <span>{PROJECT.semester}</span>
            </div>
          </>
        )}
        <div className="sidebar-header-actions">
          {onClose && (
            <button className="btn ghost icon-only sidebar-close" onClick={onClose} title="Close">
              <Icons.X size={16} />
            </button>
          )}
          {onToggleCollapse && (
            <button
              className="btn ghost icon-only"
              onClick={onToggleCollapse}
              title={collapsed ? "Expand sidebar" : "Collapse sidebar"}
            >
              <Icons.Menu size={15} />
            </button>
          )}
        </div>
      </div>

      <div className="sidebar-nav">
        {!collapsed && <div className="sidebar-section">Workspace</div>}

        <div
          className={"nav-item" + (route === "overview" ? " active" : "")}
          onClick={() => setRoute("overview")}
          title={collapsed ? "Overview" : undefined}
        >
          <Icons.Dash />
          {!collapsed && <span>Overview</span>}
        </div>

        <div
          className={"nav-item" + (route === "chat" ? " active" : "")}
          onClick={() => setRoute("chat")}
          style={collapsed ? undefined : { justifyContent: "space-between" }}
          title={collapsed ? "Chat" : undefined}
        >
          {collapsed ? (
            <Icons.Chat />
          ) : (
            <>
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
            </>
          )}
        </div>

        {!collapsed && threads && threads.length > 0 && (
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
            title={collapsed ? it.label : undefined}
          >
            <it.Icon />
            {!collapsed && <span>{it.label}</span>}
            {!collapsed && <span className="count">{it.count}</span>}
          </div>
        ))}

        {!collapsed && (
          <div className="budget-card">
            <div className="label">
              <span>Budget</span>
              <div className="budget-bar"><span style={{ width: `${pct * 100}%` }} /></div>
              <span>{Math.round(pct * 100)}%</span>
            </div>
            <div className="value">
              <span>£{(budget.committed ?? budget.spent).toFixed(2)}</span>
              <span className="of">/ £{budget.cap.toFixed(2)}</span>
            </div>
          </div>
        )}

        {!collapsed && stats?.recentActivity && stats.recentActivity.length > 0 && (
          <div className="sidebar-activity">
            <div className="sidebar-section">Recent</div>
            {stats.recentActivity.slice(0, 4).map((act, i) => (
              <div key={i} className="act-feed-row">
                <span className={"act-feed-who" + (act.who === "ai" ? " ai" : "")}>{act.who === "ai" ? "AI" : "YOU"}</span>
                <span className="act-feed-what">{act.what}</span>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="sidebar-footer">
        <div className="sidebar-user-row">
          <SidebarAvatar user={currentUser} />
          {!collapsed && (
            <div style={{ flex: 1, minWidth: 0 }}>
              <span className="sidebar-user-name">{currentUser.name}</span>
              <div className="sidebar-status-line">
                <span className="dot" /><span>Connected · v0.4.0</span>
              </div>
            </div>
          )}
          {!collapsed && (
            <button
              className="btn ghost icon-only"
              style={{ width: 24, height: 24, padding: 0, flexShrink: 0 }}
              title="Switch user"
              onClick={onSwitchUser}
            >
              <Icons.SwitchArrows size={13} />
            </button>
          )}
        </div>

        <div
          className={"nav-item" + (route === "settings" ? " active" : "")}
          onClick={() => setRoute("settings")}
          title={collapsed ? "Settings" : undefined}
        >
          <Icons.Cog />
          {!collapsed && <span>Settings</span>}
        </div>
      </div>
    </aside>
  );
}
