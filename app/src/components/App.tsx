'use client';

import React, { useState, useEffect, useCallback } from 'react';
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
import CommandPalette from './CommandPalette';
import { AppUser, getSavedUserId, saveUserId, clearUserId, getUserById } from '../lib/users';

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
};

function loadTweaks(): Tweaks {
  try {
    const raw = localStorage.getItem("pms-tweaks");
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
  const [tweaks, setTweaksState] = useState<Tweaks>(loadTweaks);
  const [selectedThreadId, setSelectedThreadIdState] = useState<string | null>(
    () => localStorage.getItem("pms-thread") ?? null
  );
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(() => {
    try { return localStorage.getItem("pms-sidebar-collapsed") === "true"; } catch { return false; }
  });
  const [cmdOpen, setCmdOpen] = useState(false);

  const handleToggleCollapse = useCallback(() => {
    setSidebarCollapsed(c => {
      const next = !c;
      try { localStorage.setItem("pms-sidebar-collapsed", String(next)); } catch {}
      return next;
    });
  }, []);

  const setRoute = useCallback((r: string) => {
    setRouteState(r);
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
      try { localStorage.setItem("pms-tweaks", JSON.stringify(next)); } catch {}
      return next;
    });
  }, []);

  useEffect(() => {
    document.documentElement.dataset.theme = tweaks.theme;
    document.documentElement.dataset.accent = tweaks.accent;
    document.documentElement.dataset.density = tweaks.density;
    document.documentElement.dataset.surface = tweaks.surface;
  }, [tweaks]);

  // Cmd+K / Ctrl+K global shortcut
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault();
        setCmdOpen(o => !o);
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  function handleSelectThread(id: string | null) {
    setSelectedThreadId(id);
    setRoute("chat");
    setSidebarOpen(false);
  }

  function handleSelectUser(user: AppUser) {
    saveUserId(user.id);
    setCurrentUser(user);
    // Reset thread selection when switching users
    setSelectedThreadId(null);
  }

  function handleSwitchUser() {
    clearUserId();
    setCurrentUser(null);
    setSelectedThreadId(null);
  }

  function handleClearThread() {
    // Called from Settings — clears the message history for the selected thread
    // The actual mutation is called inside Settings, this just resets local route state if needed
  }

  if (!currentUser) {
    return <Login onSelect={handleSelectUser} />;
  }

  let screen: React.ReactNode = null;
  if (route === "overview")       screen = <Overview setRoute={setRoute} currentUser={currentUser} />;
  else if (route === "chat")      screen = <Chat tweaks={tweaks} setRoute={setRoute} selectedThreadId={selectedThreadId} onSelectThread={setSelectedThreadId} userId={currentUser.id} />;
  else if (route === "memory")    screen = <Memory />;
  else if (route === "images")    screen = <Images currentUser={currentUser} />;
  else if (route === "components") screen = <Components />;
  else if (route === "tests")     screen = <Tests />;
  else if (route === "docs")      screen = <Docs />;
  else if (route === "settings")  screen = <Settings tweaks={tweaks} setTweak={setTweak} selectedThreadId={selectedThreadId} onClearThread={handleClearThread} />;
  else if (route === "empty")     screen = <Empty setRoute={setRoute} />;

  return (
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
        <div className="mobile-bar">
          <button className="btn ghost icon-only" onClick={() => setSidebarOpen(true)}>
            <Icons.Menu size={18} />
          </button>
          <span className="mobile-title">{ROUTE_LABELS[route] ?? route}</span>
          <button className="btn ghost icon-only" style={{ marginLeft: "auto" }} onClick={() => setCmdOpen(true)} title="Command palette (⌘K)">
            <Icons.Search />
          </button>
        </div>
        {screen}
      </main>
      <TweaksPanel tweaks={tweaks} setTweak={setTweak} route={route} setRoute={setRoute} />
      {cmdOpen && (
        <CommandPalette
          onClose={() => setCmdOpen(false)}
          onNavigate={(r) => { setRoute(r); setCmdOpen(false); }}
          currentRoute={route}
        />
      )}
    </div>
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
    ["images", "Images"], ["components", "Components"], ["tests", "Tests"],
    ["docs", "Docs"], ["settings", "Settings"], ["empty", "Empty"],
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
