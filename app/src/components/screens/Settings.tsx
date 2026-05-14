'use client';

import React, { useState } from 'react';
import { AppData } from '@/lib/data';
import * as Icons from '../Icons';

interface Tweaks {
  theme: string;
  accent: string;
  density: string;
  surface: string;
  dense: boolean;
  debug: boolean;
}

interface SettingsProps {
  data: AppData;
  tweaks: Tweaks;
  setTweak: (key: string, value: unknown) => void;
}

export default function Settings({ tweaks, setTweak }: SettingsProps) {
  const [apiKey, setApiKey] = useState("sk-or-v1-•••••••••••••••••••••••••••••••••••••••••••••");
  const [showKey, setShowKey] = useState(false);
  const [temp, setTemp] = useState(40);
  const [maxTokens, setMaxTokens] = useState(2048);

  return (
    <>
      <header className="screen-header">
        <div className="title-block">
          <div className="crumb">Workspace · Settings</div>
          <h1>Settings</h1>
        </div>
        <div className="actions">
          <button className="btn sm"><Icons.Download /><span>Export bundle</span></button>
        </div>
      </header>

      <div className="body">
        <div className="settings-wrap">

          <div className="settings-group">
            <h2>OpenRouter</h2>
            <p>Stored in browser <code>localStorage</code>, never sent to the app server.</p>
            <div className="settings-row">
              <div className="label-block">
                <div className="l">API key</div>
                <div className="h">Used for all model calls.</div>
              </div>
              <div style={{ display: "flex", gap: 6 }}>
                <input
                  className="input"
                  type={showKey ? "text" : "password"}
                  value={apiKey}
                  onChange={e => setApiKey(e.target.value)}
                />
                <button className="btn icon-only" onClick={() => setShowKey(s => !s)}>
                  {showKey ? <Icons.EyeOff /> : <Icons.Eye />}
                </button>
              </div>
            </div>
            <div className="settings-row">
              <div className="label-block">
                <div className="l">Default model</div>
                <div className="h">Boost button always overrides.</div>
              </div>
              <div className="model-picker">
                <button className="active">Flash · 2.5</button>
                <button>Sonnet · 4.6</button>
              </div>
            </div>
          </div>

          <div className="settings-group">
            <h2>Inference</h2>
            <p>Applied to every model call. Boost calls clamp temperature to 0.3 regardless.</p>
            <div className="settings-row">
              <div className="label-block">
                <div className="l">Temperature</div>
                <div className="h">0 deterministic · 1 creative.</div>
              </div>
              <div className="range-row">
                <input
                  type="range"
                  className="range"
                  min="0"
                  max="100"
                  value={temp}
                  onChange={e => setTemp(+e.target.value)}
                />
                <span className="v">{(temp / 100).toFixed(2)}</span>
              </div>
            </div>
            <div className="settings-row">
              <div className="label-block">
                <div className="l">Max output tokens</div>
                <div className="h">Hard cap per turn.</div>
              </div>
              <input
                className="input"
                type="number"
                value={maxTokens}
                onChange={e => setMaxTokens(+e.target.value)}
                style={{ width: 120 }}
              />
            </div>
          </div>

          <div className="settings-group">
            <h2>Appearance</h2>
            <p>Personal — saved to localStorage. Same controls live in the Tweaks panel.</p>
            <div className="settings-row">
              <div className="label-block">
                <div className="l">Theme</div>
                <div className="h">Light or dark.</div>
              </div>
              <div className="model-picker">
                <button className={tweaks.theme === "light" ? "active" : ""} onClick={() => setTweak("theme", "light")}>
                  <Icons.Sun size={10} /> Light
                </button>
                <button className={tweaks.theme === "dark" ? "active" : ""} onClick={() => setTweak("theme", "dark")}>
                  <Icons.Moon size={10} /> Dark
                </button>
              </div>
            </div>
            <div className="settings-row">
              <div className="label-block">
                <div className="l">Accent</div>
                <div className="h">Signal-green, amber, or electric blue.</div>
              </div>
              <div style={{ display: "flex", gap: 6 }}>
                {(["green", "amber", "blue"] as const).map(c => (
                  <button
                    key={c}
                    onClick={() => setTweak("accent", c)}
                    style={{
                      width: 28,
                      height: 28,
                      borderRadius: 6,
                      border: tweaks.accent === c ? "2px solid var(--text)" : "1px solid var(--line)",
                      background: c === "green" ? "oklch(0.68 0.14 155)" : c === "amber" ? "oklch(0.72 0.14 70)" : "oklch(0.62 0.14 240)",
                      cursor: "pointer",
                    }}
                  />
                ))}
              </div>
            </div>
            <div className="settings-row">
              <div className="label-block">
                <div className="l">Density</div>
                <div className="h">Comfortable shows more whitespace.</div>
              </div>
              <div className="model-picker">
                <button className={tweaks.density === "comfortable" ? "active" : ""} onClick={() => setTweak("density", "comfortable")}>Comfortable</button>
                <button className={tweaks.density === "compact" ? "active" : ""} onClick={() => setTweak("density", "compact")}>Compact</button>
              </div>
            </div>
          </div>

          <div className="settings-group">
            <h2>Session</h2>
            <p>Local to this device.</p>
            <div className="settings-row">
              <div className="label-block">
                <div className="l">Show retrieved context</div>
                <div className="h">Debug view of what was sent to the model.</div>
              </div>
              <div
                className={"switch" + (tweaks.debug ? " on" : "")}
                onClick={() => setTweak("debug", !tweaks.debug)}
              >
                <div className="knob" />
              </div>
            </div>
            <div className="settings-row">
              <div className="label-block">
                <div className="l">Clear conversation</div>
                <div className="h">Removes chat history. Memory and decisions are kept.</div>
              </div>
              <button className="btn sm"><Icons.Trash /><span>Clear</span></button>
            </div>
            <div className="settings-row">
              <div className="label-block">
                <div className="l">Export full state</div>
                <div className="h">Memory + decisions + components + tests as one .md bundle.</div>
              </div>
              <button className="btn sm primary"><Icons.Download /><span>Export bundle</span></button>
            </div>
          </div>

        </div>
      </div>
    </>
  );
}
