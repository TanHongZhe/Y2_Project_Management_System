'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { APP_DATA } from '@/lib/data';
import Sidebar from './Sidebar';
import Overview from './screens/Overview';
import Chat from './screens/Chat';
import Memory from './screens/Memory';
import Decisions from './screens/Decisions';
import Components from './screens/Components';
import Tests from './screens/Tests';
import Docs from './screens/Docs';
import Settings from './screens/Settings';
import Empty from './screens/Empty';

interface Tweaks {
  theme: string;
  accent: string;
  density: string;
  surface: string;
  dense: boolean;
  debug: boolean;
}

const TWEAK_DEFAULTS: Tweaks = {
  theme: "light",
  accent: "green",
  density: "comfortable",
  surface: "clean",
  dense: false,
  debug: false,
};

const ROUTE_LABELS: Record<string, string> = {
  overview: "Overview",
  chat: "Chat",
  memory: "Project Memory",
  decisions: "Decision Log",
  components: "Component Register",
  tests: "Test Results",
  docs: "Docs",
  settings: "Settings",
  empty: "New Session",
};

export default function App() {
  const [route, setRoute] = useState("overview");
  const [tweaks, setTweaksState] = useState<Tweaks>(TWEAK_DEFAULTS);

  const setTweak = useCallback((key: string, value: unknown) => {
    setTweaksState(prev => ({ ...prev, [key]: value }));
  }, []);

  useEffect(() => {
    document.documentElement.dataset.theme = tweaks.theme;
    document.documentElement.dataset.accent = tweaks.accent;
    document.documentElement.dataset.density = tweaks.density;
    document.documentElement.dataset.surface = tweaks.surface;
  }, [tweaks]);

  const data = APP_DATA;

  let screen: React.ReactNode = null;
  if (route === "overview")       screen = <Overview data={data} setRoute={setRoute} />;
  else if (route === "chat")      screen = <Chat data={data} tweaks={tweaks} setRoute={setRoute} />;
  else if (route === "memory")    screen = <Memory data={data} />;
  else if (route === "decisions") screen = <Decisions data={data} />;
  else if (route === "components") screen = <Components data={data} />;
  else if (route === "tests")     screen = <Tests data={data} />;
  else if (route === "docs")      screen = <Docs data={data} />;
  else if (route === "settings")  screen = <Settings data={data} tweaks={tweaks} setTweak={setTweak} />;
  else if (route === "empty")     screen = <Empty setRoute={setRoute} />;

  return (
    <div className="app">
      <Sidebar route={route} setRoute={setRoute} data={data} />
      <main className="main" data-screen-label={ROUTE_LABELS[route] ?? route}>
        {screen}
      </main>
      <TweaksPanel tweaks={tweaks} setTweak={setTweak} route={route} setRoute={setRoute} />
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
    ["decisions", "Decisions"], ["components", "Components"], ["tests", "Tests"],
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
