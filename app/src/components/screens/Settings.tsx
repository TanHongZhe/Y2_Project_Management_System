'use client';

import React, { useState } from 'react';
import { useQuery, useMutation } from 'convex/react';
import { api } from '../../../convex/_generated/api';
import { Id } from '../../../convex/_generated/dataModel';
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
  tweaks: Tweaks;
  setTweak: (key: string, value: unknown) => void;
  selectedThreadId: string | null;
  onClearThread: () => void;
}

export default function Settings({ tweaks, setTweak, selectedThreadId }: SettingsProps) {
  const [temp, setTemp] = useState<number>(() => {
    try { return parseInt(localStorage.getItem("pms-temp") ?? "30"); } catch { return 30; }
  });
  const [maxTokens, setMaxTokens] = useState<number>(() => {
    try { return parseInt(localStorage.getItem("pms-max-tokens") ?? "4096"); } catch { return 4096; }
  });
  const [clearing, setClearing] = useState(false);
  const [exporting, setExporting] = useState(false);

  const clearMessages = useMutation(api.threads.clearMessages);

  // Data for export
  const memoryNotes = useQuery(api.memoryNotes.list, {});
  const decisions = useQuery(api.decisions.list, { limit: 500 });
  const components = useQuery(api.components.list, { limit: 500 });
  const tests = useQuery(api.tests.list, { limit: 500 });

  async function handleClear() {
    if (!selectedThreadId) return;
    if (!confirm("Clear all messages in this conversation? Memory and decisions are kept.")) return;
    setClearing(true);
    try {
      await clearMessages({ threadId: selectedThreadId as Id<"threads"> });
    } finally {
      setClearing(false);
    }
  }

  async function handleExport() {
    setExporting(true);
    try {
      const lines: string[] = [];
      lines.push(`# Y2 Solar Bus Demonstrator — Project Export`);
      lines.push(`_Generated ${new Date().toISOString().slice(0, 16).replace("T", " ")} UTC_\n`);

      lines.push("---\n");
      lines.push("## Project Memory\n");
      for (const n of memoryNotes ?? []) {
        lines.push(`### ${n.section}`);
        lines.push(n.content);
        lines.push("");
      }

      lines.push("---\n");
      lines.push("## Decision Log\n");
      for (const d of decisions ?? []) {
        const date = new Date(d.createdAt).toISOString().slice(0, 10);
        lines.push(`### ${d.decisionId} — ${d.title}`);
        lines.push(`_${date}_ · tags: ${d.tags.join(", ") || "none"}`);
        lines.push(`\n${d.rationale}\n`);
      }

      lines.push("---\n");
      lines.push("## Component Register\n");
      lines.push("| Ref | Name | Model | Supplier | Qty | Cost (£) | Status |");
      lines.push("|-----|------|-------|----------|-----|----------|--------|");
      for (const c of components ?? []) {
        lines.push(`| ${c.ref} | ${c.name} | ${c.model ?? "—"} | ${c.supplier ?? "—"} | ${c.qty} | ${(c.estCost * c.qty).toFixed(2)} | ${c.status} |`);
      }
      lines.push("");

      lines.push("---\n");
      lines.push("## Test Results\n");
      for (const t of tests ?? []) {
        const date = new Date(t.testedAt).toISOString().slice(0, 10);
        lines.push(`### ${t.testId} — ${t.title}`);
        lines.push(`_${date}_ · subsystem: ${t.subsystem} · result: **${t.result}**`);
        if (t.metrics.length > 0) {
          lines.push("\n| Key | Value | Unit |");
          lines.push("|-----|-------|------|");
          for (const m of t.metrics) lines.push(`| ${m.key} | ${m.value} | ${m.unit ?? "—"} |`);
        }
        if (t.notes) lines.push(`\n${t.notes}`);
        lines.push("");
      }

      const blob = new Blob([lines.join("\n")], { type: "text/markdown" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `y2-pms-export-${new Date().toISOString().slice(0, 10)}.md`;
      a.click();
      URL.revokeObjectURL(url);
    } finally {
      setExporting(false);
    }
  }

  return (
    <>
      <header className="screen-header">
        <div className="title-block">
          <div className="crumb">Workspace · Settings</div>
          <h1>Settings</h1>
        </div>
        <div className="actions">
          <button className="btn sm primary" onClick={handleExport} disabled={exporting}>
            <Icons.Download /><span>{exporting ? "Exporting…" : "Export bundle"}</span>
          </button>
        </div>
      </header>

      <div className="body">
        <div className="settings-wrap">

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
                  onChange={e => { const v = +e.target.value; setTemp(v); try { localStorage.setItem("pms-temp", String(v)); } catch {} }}
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
                min={256}
                max={16384}
                step={256}
                onChange={e => { const v = +e.target.value; setMaxTokens(v); try { localStorage.setItem("pms-max-tokens", String(v)); } catch {} }}
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
                <div className="h">Removes chat history for the active thread. Memory and decisions are kept.</div>
              </div>
              <button
                className="btn sm"
                onClick={handleClear}
                disabled={!selectedThreadId || clearing}
              >
                <Icons.Trash /><span>{clearing ? "Clearing…" : "Clear"}</span>
              </button>
            </div>
            <div className="settings-row">
              <div className="label-block">
                <div className="l">Export full state</div>
                <div className="h">Memory + decisions + components + tests as one .md bundle.</div>
              </div>
              <button className="btn sm primary" onClick={handleExport} disabled={exporting}>
                <Icons.Download /><span>{exporting ? "Exporting…" : "Export bundle"}</span>
              </button>
            </div>
          </div>

        </div>
      </div>
    </>
  );
}
