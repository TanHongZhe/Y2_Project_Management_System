'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { ToastProvider } from './Toast';
import { pushRecentRoute } from './CommandPalette';
import Sidebar from './Sidebar';
import * as Icons from './Icons';
import Overview from './screens/Overview';
import Chat from './screens/Chat';
import Memory from './screens/Memory';
import Images from './screens/Images';
import Components from './screens/Components';
import Tests from './screens/Tests';
import Docs from './screens/Docs';
import Settings from './screens/Settings';
import Empty from './screens/Empty';
import Login from './screens/Login';
import Meetings from './screens/Meetings';
import Calendar from './screens/Calendar';
import CommandPalette from './CommandPalette';
import GlobalSearch from './GlobalSearch';
import NotificationBell from './NotificationBell';
import TeamChat from './TeamChat';
import { AppUser, getSavedUserId, saveUserId, clearUserId, getUserById } from '../lib/users';
import { useMutation } from 'convex/react';
import { api } from '../../convex/_generated/api';

interface Tweaks {
  theme: string;
  accent: string;
  density: string;
  surface: string;
  dense: boolean;
  debug: boolean;
}

const TWEAK_DEFAULTS: Tweaks = {
  theme: "dark",
  accent: "amber",
  density: "comfortable",
  surface: "clean",
  dense: false,
  debug: false,
};

const ROUTE_LABELS: Record<string, string> = {
  overview: "Overview",
  chat: "Chat",
  memory: "Project Memory",
  images: "Images",
  components: "Component Register",
  tests: "Test Results",
  docs: "Docs",
  settings: "Settings",
  empty: "New Session",
  meetings: "Notes",
  calendar: "Calendar",
};

function loadTweaks(userId?: string): Tweaks {
  if (!userId) return TWEAK_DEFAULTS;
  try {
    const raw = localStorage.getItem(`pms-tweaks-${userId}`);
    if (raw) return { ...TWEAK_DEFAULTS, ...JSON.parse(raw) };
  } catch {}
  return TWEAK_DEFAULTS;
}

export default function App() {
  const [currentUser, setCurrentUser] = useState<AppUser | null>(() => {
    const id = getSavedUserId();
    return id ? (getUserById(id) ?? null) : null;
  });
  const [route, setRouteState] = useState<string>(() => localStorage.getItem("pms-route") ?? "overview");
  const [tweaks, setTweaksState] = useState<Tweaks>(() => {
    const id = getSavedUserId();
    return loadTweaks(id ?? undefined);
  });
  const [selectedThreadId, setSelectedThreadIdState] = useState<string | null>(
    () => localStorage.getItem("pms-thread") ?? null
  );
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(() => {
    try { return localStorage.getItem("pms-sidebar-collapsed") === "true"; } catch { return false; }
  });
  const [cmdOpen, setCmdOpen] = useState(false);
  const [selectedDocId, setSelectedDocId] = useState<string | null>(null);
  const [selectedMeetingId, setSelectedMeetingId] = useState<string | null>(null);
  const [pendingRecord, setPendingRecord] = useState(false);
  const [chatOpen, setChatOpen] = useState(false);

  const handleToggleCollapse = useCallback(() => {
    setSidebarCollapsed(c => {
      const next = !c;
      try { localStorage.setItem("pms-sidebar-collapsed", String(next)); } catch {}
      return next;
    });
  }, []);

  const setRoute = useCallback((r: string) => {
    setRouteState(r);
    pushRecentRoute(r);
    localStorage.setItem("pms-route", r);
  }, []);

  const setSelectedThreadId = useCallback((id: string | null) => {
    setSelectedThreadIdState(id);
    if (id) localStorage.setItem("pms-thread", id);
    else localStorage.removeItem("pms-thread");
  }, []);

  const setTweak = useCallback((key: string, value: unknown) => {
    setTweaksState(prev => {
      const next = { ...prev, [key]: value };
      const id = getSavedUserId();
      if (id) try { localStorage.setItem(`pms-tweaks-${id}`, JSON.stringify(next)); } catch {}
      return next;
    });
  }, []);

  useEffect(() => {
    const resolvedTheme = tweaks.theme === 'system'
      ? (window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light')
      : tweaks.theme;
    document.documentElement.dataset.theme = resolvedTheme;
    document.documentElement.dataset.accent = tweaks.accent;
    document.documentElement.dataset.density = tweaks.density;
    document.documentElement.dataset.surface = tweaks.surface;
  }, [tweaks]);

  // Follow OS dark/light preference when theme === 'system'
  useEffect(() => {
    if (tweaks.theme !== 'system') return;
    const mq = window.matchMedia('(prefers-color-scheme: dark)');
    const handler = () => { document.documentElement.dataset.theme = mq.matches ? 'dark' : 'light'; };
    mq.addEventListener('change', handler);
    return () => mq.removeEventListener('change', handler);
  }, [tweaks.theme]);

  // Heartbeat — keeps this user's presence alive in the heartbeats table
  /* eslint-disable @typescript-eslint/no-explicit-any */
  const pingHeartbeat = useMutation((api as any).heartbeats.ping);
  /* eslint-enable @typescript-eslint/no-explicit-any */
  useEffect(() => {
    if (!currentUser || currentUser.isGuest) return;
    void pingHeartbeat({ userId: currentUser.id });
    const id = setInterval(() => void pingHeartbeat({ userId: currentUser.id }), 30_000);
    return () => clearInterval(id);
  }, [currentUser, pingHeartbeat]);

  const [shortcutsOpen, setShortcutsOpen] = useState(false);

  // Global keyboard shortcuts
  useEffect(() => {
    const ROUTE_KEYS: Record<string, string> = {
      '1': 'overview', '2': 'chat', '3': 'memory', '4': 'meetings',
      '5': 'calendar', '6': 'images', '7': 'components', '8': 'tests', '9': 'docs', '0': 'settings',
    };
    function onKey(e: KeyboardEvent) {
      // Cmd+K → command palette
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') { e.preventDefault(); setCmdOpen(o => !o); return; }
      // Ctrl+Shift+R → new meeting + record
      if ((e.metaKey || e.ctrlKey) && e.shiftKey && e.key === 'R') {
        e.preventDefault();
        if (!currentUser || currentUser.isGuest) return;
        setRoute('meetings'); setPendingRecord(true); return;
      }
      // Skip if focus is in an input/textarea/editor
      const tag = (document.activeElement as HTMLElement)?.tagName ?? '';
      const ce = (document.activeElement as HTMLElement)?.getAttribute('contenteditable');
      if (tag === 'INPUT' || tag === 'TEXTAREA' || ce === 'true') return;
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      // ? → shortcuts modal
      if (e.key === '?') { setShortcutsOpen(o => !o); return; }
      // Esc → close shortcuts modal / chat
      if (e.key === 'Escape') { setShortcutsOpen(false); setChatOpen(false); return; }
      // c → toggle team chat
      if (e.key === 'c' || e.key === 'C') { setChatOpen(o => !o); return; }
      // 1–9 → jump to screen
      if (e.key in ROUTE_KEYS) { setRoute(ROUTE_KEYS[e.key]); }
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [currentUser, setRoute]);

  function handleSelectThread(id: string | null) {
    setSelectedThreadId(id);
    setRoute("chat");
    setSidebarOpen(false);
  }

  function handleSelectUser(user: AppUser) {
    saveUserId(user.id);
    setCurrentUser(user);
    setTweaksState(loadTweaks(user.id));
    setSelectedThreadId(null);
  }

  function handleSwitchUser() {
    clearUserId();
    setCurrentUser(null);
    setTweaksState(TWEAK_DEFAULTS);
    setSelectedThreadId(null);
  }

  function handleClearThread() {
    // Called from Settings — clears the message history for the selected thread
    // The actual mutation is called inside Settings, this just resets local route state if needed
  }

  const handleDocConsumed = useCallback(() => setSelectedDocId(null), []);
  const handleMeetingConsumed = useCallback(() => setSelectedMeetingId(null), []);
  const handleRecordConsumed = useCallback(() => setPendingRecord(false), []);

  if (!currentUser) {
    return <Login onSelect={handleSelectUser} />;
  }
  const handleNotificationClick = (r: string, linkId?: string) => {
    if (r === "meetings" && linkId) setSelectedMeetingId(linkId);
    setRoute(r);
  };
  const searchBar = (
    <div className="search-bar-wrap">
      <GlobalSearch setRoute={setRoute} onSelectDoc={setSelectedDocId} onSelectMeeting={setSelectedMeetingId} />
      {!currentUser.isGuest && (
        <NotificationBell userId={currentUser.id} onNotificationClick={handleNotificationClick} />
      )}
    </div>
  );

  let screen: React.ReactNode = null;
  if (route === "overview")        screen = <Overview setRoute={setRoute} currentUser={currentUser} searchBar={searchBar} />;
  else if (route === "chat")       screen = <Chat tweaks={tweaks} setRoute={setRoute} selectedThreadId={selectedThreadId} onSelectThread={setSelectedThreadId} userId={currentUser.id} searchBar={searchBar} />;
  else if (route === "memory")     screen = <Memory readOnly={currentUser.isGuest} searchBar={searchBar} currentUserId={currentUser.id} />;
  else if (route === "images")     screen = <Images currentUser={currentUser} searchBar={searchBar} />;
  else if (route === "components") screen = <Components readOnly={currentUser.isGuest} searchBar={searchBar} />;
  else if (route === "tests")      screen = <Tests readOnly={currentUser.isGuest} searchBar={searchBar} currentUserId={currentUser.id} />;
  else if (route === "docs")       screen = <Docs readOnly={currentUser.isGuest} searchBar={searchBar} selectedDocId={selectedDocId ?? undefined} onDocConsumed={handleDocConsumed} />;
  else if (route === "settings")   screen = <Settings tweaks={tweaks} setTweak={setTweak} selectedThreadId={selectedThreadId} onClearThread={handleClearThread} searchBar={searchBar} />;
  else if (route === "empty")      screen = <Empty setRoute={setRoute} />;
  else if (route === "meetings")   screen = <Meetings currentUser={currentUser} readOnly={currentUser.isGuest} searchBar={searchBar} selectedMeetingId={selectedMeetingId ?? undefined} onMeetingConsumed={handleMeetingConsumed} pendingRecord={pendingRecord} onRecordConsumed={handleRecordConsumed} />;
  else if (route === "calendar")   screen = <Calendar currentUser={currentUser} searchBar={searchBar} />;

  return (
    <ToastProvider>
    <div className={"app" + (sidebarCollapsed ? " sidebar-collapsed" : "")}>
      <Sidebar
        route={route}
        setRoute={(r) => { setRoute(r); setSidebarOpen(false); }}
        selectedThreadId={selectedThreadId}
        onSelectThread={handleSelectThread}
        isOpen={sidebarOpen}
        onClose={() => setSidebarOpen(false)}
        currentUser={currentUser}
        onSwitchUser={handleSwitchUser}
        collapsed={sidebarCollapsed}
        onToggleCollapse={handleToggleCollapse}
      />
      {sidebarOpen && <div className="sidebar-backdrop" onClick={() => setSidebarOpen(false)} />}
      <main className="main" data-screen-label={ROUTE_LABELS[route] ?? route}>
        {/* Top loading bar — re-mounts on route change, plays once */}
        <div key={`loader-${route}`} className="route-top-loader" aria-hidden />
        <div className="mobile-bar">
          <button className="btn ghost icon-only" onClick={() => setSidebarOpen(true)}>
            <Icons.Menu size={18} />
          </button>
          <span className="mobile-title">{ROUTE_LABELS[route] ?? route}</span>
          <button className="btn ghost icon-only" style={{ marginLeft: "auto" }} onClick={() => setCmdOpen(true)} title="Command palette (⌘K)">
            <Icons.Search />
          </button>
        </div>
        <div key={route} className="screen-enter">
          {screen}
        </div>
      </main>
      <TweaksPanel tweaks={tweaks} setTweak={setTweak} route={route} setRoute={setRoute} />
      {cmdOpen && (
        <CommandPalette
          onClose={() => setCmdOpen(false)}
          onNavigate={(r) => { setRoute(r); setCmdOpen(false); }}
          currentRoute={route}
          onNewMeeting={() => { setRoute('meetings'); setCmdOpen(false); }}
          onNewTodo={() => { setRoute('overview'); setCmdOpen(false); }}
        />
      )}
      {shortcutsOpen && (
        <div className="shortcuts-overlay" onClick={() => setShortcutsOpen(false)}>
          <div className="shortcuts-modal" onClick={e => e.stopPropagation()}>
            <div className="shortcuts-header">
              <span>Keyboard shortcuts</span>
              <button className="btn ghost icon-only sm" onClick={() => setShortcutsOpen(false)}>✕</button>
            </div>
            <div className="shortcuts-body">
              {[
                ['⌘ K',        'Open command palette'],
                ['⌘ ⇧ R',      'New meeting + record'],
                ['?',          'This shortcuts modal'],
                ['Esc',        'Close any modal'],
                ['C',          'Toggle team chat'],
                ['1',          'Go to Overview'],
                ['2',          'Go to Chat'],
                ['3',          'Go to Project Memory'],
                ['4',          'Go to Meetings'],
                ['5',          'Go to Calendar'],
                ['6',          'Go to Images'],
                ['7',          'Go to Components'],
                ['8',          'Go to Test Results'],
                ['9',          'Go to Docs'],
                ['0',          'Go to Settings'],
              ].map(([k, desc]) => (
                <div key={k} className="shortcut-row">
                  <span className="shortcut-key">{k}</span>
                  <span className="shortcut-desc">{desc}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
      <TeamChat
        currentUser={currentUser}
        isOpen={chatOpen}
        onToggle={() => setChatOpen(o => !o)}
        onNavigate={(r, id) => {
          if (r === 'meetings' && id) setSelectedMeetingId(id);
          setRoute(r);
        }}
      />
    </ToastProvider>
  );
}

function TweaksPanel({
  tweaks,
  setTweak,
  route,
  setRoute,
}: {
  tweaks: Tweaks;
  setTweak: (k: string, v: unknown) => void;
  route: string;
  setRoute: (r: string) => void;
}) {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const onMsg = (e: MessageEvent) => {
      const t = e?.data?.type;
      if (t === '__activate_edit_mode') setOpen(true);
      else if (t === '__deactivate_edit_mode') setOpen(false);
    };
    window.addEventListener('message', onMsg);
    window.parent.postMessage({ type: '__edit_mode_available' }, '*');
    return () => window.removeEventListener('message', onMsg);
  }, []);

  const dismiss = () => {
    setOpen(false);
    window.parent.postMessage({ type: '__edit_mode_dismissed' }, '*');
  };

  if (!open) return null;

  const screens = [
    ["overview", "Overview"], ["chat", "Chat"], ["memory", "Memory"],
    ["calendar", "Calendar"], ["images", "Images"], ["components", "Components"],
    ["tests", "Tests"], ["docs", "Docs"], ["meetings", "Meetings"],
    ["settings", "Settings"], ["empty", "Empty"],
  ];

  return (
    <div className="twk-panel">
      <div className="twk-hd">
        <b>Tweaks</b>
        <button className="twk-x" onClick={dismiss}>✕</button>
      </div>
      <div className="twk-body">
        <div className="twk-sect">Theme</div>

        <div className="twk-row">
          <div className="twk-lbl"><span>Mode</span></div>
          <div className="twk-seg">
            <div className="twk-seg-thumb" style={{ left: tweaks.theme === "light" ? "2px" : "calc(2px + (100% - 4px) / 2)", width: "calc((100% - 4px) / 2)" }} />
            {(["light", "dark"] as const).map(v => (
              <button key={v} type="button" onClick={() => setTweak("theme", v)}>{v === "light" ? "Light" : "Dark"}</button>
            ))}
          </div>
        </div>

        <div className="twk-row">
          <div className="twk-lbl"><span>Accent</span></div>
          <div className="twk-seg">
            {(["green", "amber", "blue"] as const).map((v, i) => (
              <button key={v} type="button" onClick={() => setTweak("accent", v)}
                style={{
                  background: tweaks.accent === v
                    ? (v === "green" ? "oklch(0.68 0.14 155)" : v === "amber" ? "oklch(0.72 0.14 70)" : "oklch(0.62 0.14 240)")
                    : undefined,
                  color: tweaks.accent === v ? "#fff" : undefined,
                  borderRadius: i === 0 ? "6px 0 0 6px" : i === 2 ? "0 6px 6px 0" : undefined,
                }}>
                {v.charAt(0).toUpperCase() + v.slice(1)}
              </button>
            ))}
          </div>
        </div>

        <div className="twk-sect">Layout</div>

        <div className="twk-row">
          <div className="twk-lbl"><span>Density</span></div>
          <div className="twk-seg">
            {(["comfortable", "compact"] as const).map((v, i) => (
              <button key={v} type="button" onClick={() => setTweak("density", v)}
                style={{ fontWeight: tweaks.density === v ? 600 : undefined }}>
                {i === 0 ? "Comfy" : "Compact"}
              </button>
            ))}
          </div>
        </div>

        <div className="twk-row">
          <div className="twk-lbl"><span>Surface</span></div>
          <div className="twk-seg">
            {(["clean", "notebook"] as const).map(v => (
              <button key={v} type="button" onClick={() => setTweak("surface", v)}
                style={{ fontWeight: tweaks.surface === v ? 600 : undefined }}>
                {v.charAt(0).toUpperCase() + v.slice(1)}
              </button>
            ))}
          </div>
        </div>

        <div className="twk-row twk-row-h">
          <div className="twk-lbl"><span>Hide chat rail</span></div>
          <button type="button" className="twk-toggle" data-on={tweaks.dense ? "1" : "0"}
            onClick={() => setTweak("dense", !tweaks.dense)}><i /></button>
        </div>

        <div className="twk-sect">Jump to screen</div>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 6, padding: "2px 0 4px" }}>
          {screens.map(([k, l]) => (
            <button
              key={k}
              onClick={() => setRoute(k)}
              style={{
                border: "1px solid var(--line)",
                background: route === k ? "var(--text)" : "var(--bg-elev)",
                color: route === k ? "var(--bg)" : "var(--text)",
                borderRadius: 4,
                padding: "6px 8px",
                fontFamily: "var(--font-mono)",
                fontSize: 10,
                letterSpacing: "0.04em",
                textTransform: "uppercase",
                cursor: "pointer",
              }}
            >{l}</button>
          ))}
        </div>
      </div>
    </div>
  );
}
