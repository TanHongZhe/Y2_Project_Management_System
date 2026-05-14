'use client';

import React, { useState, useEffect, useRef, useMemo } from 'react';
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

interface ChatProps {
  data: AppData;
  tweaks: Tweaks;
  setRoute: (r: string) => void;
}

interface Citation {
  n: number;
  file: string;
  section: string;
}

interface ToolCall {
  name: string;
  args: string;
  diff: string;
  status: string;
}

interface MessageData {
  role: "user" | "ai";
  who: "you" | "ai";
  model?: string | null;
  ts: string;
  boost?: boolean;
  streaming?: boolean;
  toolCall?: ToolCall | null;
  streamText?: string;
  citations?: Citation[];
  content?: React.ReactNode;
}

function Message({ m }: { m: MessageData }) {
  const isUser = m.role === "user";
  return (
    <div className="msg-row">
      <div className={"msg-avatar " + (isUser ? "user" : "ai")}>{isUser ? "ME" : "AI"}</div>
      <div className="msg-body">
        <div className="msg-meta">
          <span className="role">{isUser ? "You" : "Assistant"}</span>
          {m.model && (
            <span className={"model-tag" + (m.boost ? " boost" : "")}>
              {m.boost && <Icons.Bolt size={9} />}
              {m.model}
            </span>
          )}
          <span>{m.ts}</span>
        </div>
        <div className="msg-content">
          {m.streamText
            ? <p>{m.streamText}{m.streaming && <span className="caret" />}</p>
            : m.content}
        </div>

        {m.toolCall && (
          <div className="tool-call">
            <div className="head">
              <Icons.Branch size={12} />
              <span className="name">{m.toolCall.name}</span>
              <span style={{ color: "var(--text-faint)" }}>({m.toolCall.args})</span>
              <span className="status"><span className="dot" /> applied</span>
            </div>
            <div className="body-tc">
              <span className="k">+ </span><span className="added">{m.toolCall.diff}</span>
            </div>
          </div>
        )}

        {m.citations && m.citations.length > 0 && (
          <div className="citations">
            {m.citations.map(c => (
              <span className="citation-chip" key={c.n} title="Click to open source">
                <span className="num">{c.n}</span>
                <span>{c.file}</span>
                <span style={{ color: "var(--text-faint)" }}>· {c.section}</span>
              </span>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

export default function Chat({ data, tweaks, setRoute }: ChatProps) {
  const [boost, setBoost] = useState(false);
  const [showDebug, setShowDebug] = useState(false);
  const [railTab, setRailTab] = useState("memory");
  const [draft, setDraft] = useState("");
  const [streaming, setStreaming] = useState(false);
  const [streamText, setStreamText] = useState("");
  const taRef = useRef<HTMLTextAreaElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  const seedMessages = useMemo<MessageData[]>(() => ([
    {
      role: "user", who: "you", model: null, ts: "11:38",
      content: <p>What ripple should I expect on the 3.30 V rail once the LED PWM is on, and is the current bulk cap big enough?</p>,
    },
    {
      role: "ai", who: "ai", model: "gemini-flash", ts: "11:38", boost: false,
      content: (
        <>
          <p>Short answer: with the present 47 µF X7R output cap and PWM at 1 kHz, expect injected ripple in the <strong>80–110 mVpp</strong> range during transitions, which is over your <code>50 mVpp</code> target.</p>
          <p>Here&apos;s why, working from what&apos;s in memory:</p>
          <ul>
            <li>From <code>Bus Voltage</code>, switch frequency is <strong>500 kHz</strong> and you&apos;re using a 47 µF output cap.</li>
            <li>From test <strong>T-017</strong> you already measured <strong>95 mVpp</strong> with PWM at 50% duty — that matches the back-of-envelope figure for switching the 8 × 20 mA LED string through U3.</li>
            <li>U2 (TPS63802) loop bandwidth is ~30 kHz, so it cannot reject a 1 kHz square-edge disturbance from a downstream stage as fast as the cap can.</li>
          </ul>
          <p>Two cheap fixes that fit your BOM budget:</p>
          <ol>
            <li>Add a parallel <strong>22 µF X7R + 100 nF</strong> on the 3.30 V rail right at U3&apos;s input — same footprint family you already have. Should knock ripple down to ~40 mVpp.</li>
            <li>Slow U3&apos;s gate drive by adding a 22 Ω in series with each LED — costs you ~1.5% efficiency but removes the spike pair entirely.</li>
          </ol>
          <p>Option 1 is the one I&apos;d log. Want me to add it as a decision and bump C-07 budget by ~£0.40?</p>
        </>
      ),
      citations: [
        { n: 1, file: "project_memory.md", section: "Bus Voltage" },
        { n: 2, file: "tests.json", section: "T-017 — Ripple under LED PWM" },
        { n: 3, file: "tps63802.pdf", section: "p.14 — Loop response" },
      ],
    },
    {
      role: "user", who: "you", model: null, ts: "11:41",
      content: <p>Yes, log it as decision and add a 22 µF cap to components.</p>,
    },
  ]), []);

  const finalReply = `Logged. I've appended **D-011** to the Decision Log and added the 22 µF X7R cap to the component register (status \`planned\`, est. £0.42 from Mouser).\n\nNext, run a fresh ripple measurement on the bench once the cap is in — I'll watch for the result and link it back to D-011.`;

  function handleSend() {
    if (!draft.trim() || streaming) return;
    setStreaming(true);
    setStreamText("");
    const words = finalReply.split(" ");
    let i = 0;
    const tick = () => {
      i++;
      setStreamText(words.slice(0, i).join(" "));
      if (i < words.length) setTimeout(tick, 40 + Math.random() * 60);
      else setStreaming(false);
    };
    setTimeout(tick, 350);
    setDraft("");
    if (taRef.current) taRef.current.style.height = "auto";
  }

  useEffect(() => {
    if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
  }, [streamText, streaming]);

  function onKey(e: React.KeyboardEvent) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  }

  function onInput(e: React.ChangeEvent<HTMLTextAreaElement>) {
    setDraft(e.target.value);
    const el = e.target;
    el.style.height = "auto";
    el.style.height = Math.min(200, el.scrollHeight) + "px";
  }

  const streamMsg: MessageData = {
    role: "ai", who: "ai",
    model: boost ? "claude-sonnet-4.6" : "gemini-flash",
    ts: "now",
    boost,
    streaming,
    toolCall: !streaming && streamText ? {
      name: "update_memory",
      args: 'section: "Decisions", id: "D-011"',
      diff: 'D-011 — Add 22 µF X7R parallel cap on 3.30 V rail at U3 input. Reduces ripple under LED PWM from 95 mVpp → ~40 mVpp.',
      status: "applied"
    } : null,
    streamText,
    citations: streamText && !streaming ? [
      { n: 1, file: "project_memory.md", section: "Decisions / D-011" },
      { n: 2, file: "components.json", section: "C-13 (new)" },
    ] : [],
  };

  return (
    <>
      <header className="screen-header">
        <div className="title-block">
          <div className="crumb">Workspace · Chat</div>
          <h1>Project memory session</h1>
        </div>
        <div className="actions">
          <button className={"btn ghost sm" + (showDebug ? " primary" : "")} onClick={() => setShowDebug(s => !s)}>
            {showDebug ? <Icons.EyeOff /> : <Icons.Eye />}
            <span>Show context</span>
          </button>
          <button className="btn ghost icon-only" title="Restart conversation"><Icons.Restart /></button>
          <button className="btn sm"><Icons.Download /><span>Export</span></button>
        </div>
      </header>

      <div className={"chat-layout" + (tweaks.dense ? " no-rail" : "")}>
        <div className="chat-col">
          <div className="chat-scroll" ref={scrollRef}>
            {showDebug && (
              <div className="debug-pane">
                <div><span className="lbl">Sent to model</span></div>
                <div style={{ marginTop: 6 }}>
                  <span className="hl">system</span>: You are a hardware-project copilot. Use project_memory.md as ground truth.{" "}
                  <span className="hl">tools</span>: update_memory(section, content), add_component(...), log_decision(...), log_test_result(...){" "}
                  <span className="hl">context_bytes</span>: 38_412 / 1_048_576 (3.7%){" "}
                  <span className="hl">files_attached</span>: project_memory.md, components.json, decisions.json, tests.json, README.md, schematic-rev3.pdf
                </div>
              </div>
            )}

            <div className="chat-thread">
              {seedMessages.map((m, i) => (
                <Message key={i} m={m} />
              ))}

              {(streaming || streamText) && (
                <Message m={streamMsg} />
              )}
            </div>
          </div>

          <div className="composer-wrap">
            <div className="composer">
              <textarea
                ref={taRef}
                placeholder="Ask about the project, or describe a decision to log…"
                value={draft}
                onChange={onInput}
                onKeyDown={onKey}
              />
              <div className="composer-bar">
                <div className="left">
                  <div className="model-picker">
                    <button className={!boost ? "active" : ""} onClick={() => setBoost(false)}>
                      <span>Flash</span><span className="price">~£0.001</span>
                    </button>
                    <button className={"boost " + (boost ? "active" : "")} onClick={() => setBoost(true)}>
                      <Icons.Bolt size={11} /><span>Boost</span><span className="price">~£0.02</span>
                    </button>
                  </div>
                </div>
                <div className="right">
                  <span className="hint"><span className="kbd">⏎</span> send · <span className="kbd">⇧⏎</span> newline</span>
                  <button className="btn primary sm" onClick={handleSend} disabled={!draft.trim() || streaming}>
                    <Icons.Send size={12} />
                    <span>Send</span>
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>

        {!tweaks.dense && (
          <aside className="chat-rail">
            <div className="rail-tabs">
              <button className={railTab === "memory" ? "active" : ""} onClick={() => setRailTab("memory")}>Memory</button>
              <button className={railTab === "activity" ? "active" : ""} onClick={() => setRailTab("activity")}>Activity</button>
              <button className={railTab === "sources" ? "active" : ""} onClick={() => setRailTab("sources")}>Sources</button>
            </div>
            <div className="rail-scroll">
              {railTab === "memory" && (
                <>
                  <div className="rail-section">
                    <h4>Pinned <span className="badge">3</span></h4>
                    <div className="item">
                      Bus target <code>3.30 V ± 2%</code>, ripple ≤ 50 mVpp
                      <span className="ts">memory · Bus Voltage</span>
                    </div>
                    <div className="item">
                      MPPT: P&amp;O, step 50 mV / 200 ms
                      <span className="ts">memory · SMPS Roles</span>
                    </div>
                    <div className="item">
                      LED driver kept separate from bus regulator (D-007)
                      <span className="ts">decision · 2026-04-28</span>
                    </div>
                  </div>
                  <div className="rail-section">
                    <h4>Open questions</h4>
                    <div className="item">Q-001 — Share buck-boost clock with MCU?</div>
                    <div className="item">Q-002 — Is the bleed resistor necessary?</div>
                    <div className="item">Q-003 — STM32 I²C locks during PWM ISR</div>
                  </div>
                  <div className="rail-section">
                    <h4>Recent tests</h4>
                    <div className="item">T-021 — MPPT sweep: 6.20 V / 0.42 A<span className="ts">2026-05-13</span></div>
                    <div className="item">T-020 — Charge 1.0 V → 4.8 V in 14:28<span className="ts">2026-05-12</span></div>
                    <div className="item">T-019 — Bus regulation, ΔV −38 mV @ 1 A<span className="ts">2026-05-10</span></div>
                  </div>
                </>
              )}
              {railTab === "activity" && (
                <div className="rail-section">
                  <h4>This session</h4>
                  {data.recentMemoryActivity.map((a, i) => (
                    <div className="item" key={i}>
                      {a.what}
                      <span className="ts">{a.ts} · {a.who === "ai" ? "AI" : "you"}</span>
                    </div>
                  ))}
                </div>
              )}
              {railTab === "sources" && (
                <div className="rail-section">
                  <h4>Cited this turn</h4>
                  <div className="item"><code>project_memory.md</code> · Bus Voltage<span className="ts">cited × 2</span></div>
                  <div className="item"><code>tests.json</code> · T-017<span className="ts">cited × 1</span></div>
                  <div className="item"><code>tps63802.pdf</code> · p. 14<span className="ts">cited × 1</span></div>
                </div>
              )}
            </div>
          </aside>
        )}
      </div>
    </>
  );
}
