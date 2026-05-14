'use client';

import React from 'react';
import { useQuery } from 'convex/react';
import { api } from '../../../convex/_generated/api';
import * as Icons from '../Icons';

interface OverviewProps {
  setRoute: (r: string) => void;
}

const PROJECT_NAME = "Solar Bus Demonstrator";

function relativeTime(ts: number): string {
  const diff = Date.now() - ts;
  const m = Math.floor(diff / 60_000);
  if (m < 1) return "just now";
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  const d = Math.floor(h / 24);
  if (d < 30) return `${d}d ago`;
  return new Date(ts).toISOString().slice(0, 10);
}

export default function Overview({ setRoute }: OverviewProps) {
  const stats = useQuery(api.overview.stats, {});

  if (!stats) {
    return (
      <>
        <header className="screen-header">
          <div className="title-block">
            <div className="crumb">Workspace · Overview</div>
            <h1>{PROJECT_NAME}</h1>
          </div>
        </header>
        <div className="body">
          <div style={{ padding: 40, color: "var(--text-muted)" }}>Loading…</div>
        </div>
      </>
    );
  }

  const { counts, budget, componentStatus, subsystems, recentDecisions, recentTests, recentActivity } = stats;

  return (
    <>
      <header className="screen-header">
        <div className="title-block">
          <div className="crumb">Workspace · Overview</div>
          <h1>{PROJECT_NAME}</h1>
        </div>
        <div className="actions">
          <button className="btn ghost sm"><Icons.Clock /><span>Live</span></button>
          <button className="btn sm" onClick={() => setRoute("chat")}><Icons.Chat /><span>Continue chat</span></button>
          <button className="btn primary sm" onClick={() => setRoute("empty")}><Icons.Plus /><span>New session</span></button>
        </div>
      </header>

      <div className="body">
        <div className="dash">

          <div className="card brief">
            <div className="kicker">
              <span className="dot" /> Snapshot · {new Date().toISOString().slice(0, 16).replace("T", " ")}
            </div>
            <div className="brief-body">
              <p>
                {counts.decisions} decision{counts.decisions === 1 ? "" : "s"} logged,{" "}
                {counts.tests} test{counts.tests === 1 ? "" : "s"} on record,{" "}
                {counts.documents} document{counts.documents === 1 ? "" : "s"} ingested.
                Budget <strong>{Math.round(budget.pct * 100)}%</strong> spent
                — £{budget.remaining.toFixed(2)} remaining of £{budget.cap.toFixed(2)}.
              </p>
            </div>
            <div className="brief-tags">
              <span className="micro">Next action</span>
              <span className="tag bom">Continue ingesting docs in the Docs tab</span>
            </div>
          </div>

          <div className="kpi">
            <div className="kpi-cell">
              <div className="kpi-label">Components</div>
              <div className="kpi-value">{counts.components}</div>
              <div className="kpi-sub">parts in BOM</div>
            </div>
            <div className="kpi-cell">
              <div className="kpi-label">Budget remaining</div>
              <div className="kpi-value">£{budget.remaining.toFixed(2)}</div>
              <div className="kpi-sub">{Math.round(budget.pct * 100)}% of £{budget.cap.toFixed(0)} spent</div>
            </div>
            <div className="kpi-cell">
              <div className="kpi-label">Decisions</div>
              <div className="kpi-value">{counts.decisions}</div>
              <div className="kpi-sub">logged</div>
            </div>
            <div className="kpi-cell">
              <div className="kpi-label">Tests</div>
              <div className="kpi-value">{counts.tests}</div>
              <div className="kpi-sub">on record</div>
            </div>
            <div className="kpi-cell">
              <div className="kpi-label">Memory notes</div>
              <div className="kpi-value">{counts.memoryNotes}</div>
              <div className="kpi-sub">sections</div>
            </div>
            <div className="kpi-cell">
              <div className="kpi-label">Documents</div>
              <div className="kpi-value">{counts.documents}</div>
              <div className="kpi-sub">ingested</div>
            </div>
          </div>

          <div className="dash-grid">

            <div className="card span-2">
              <div className="card-head">
                <h3>Subsystem status</h3>
                <button className="btn ghost sm" onClick={() => setRoute("tests")}>
                  <span>All tests</span><Icons.Open size={11} />
                </button>
              </div>
              {subsystems.length === 0 ? (
                <div style={{ padding: 24, textAlign: "center", color: "var(--text-muted)" }}>
                  No tests recorded yet. Log a test in chat or use the Tests tab.
                </div>
              ) : (
                <div className="subsys-grid">
                  {subsystems.map(s => {
                    const health = s.lastResult === "pass" ? "ok"
                                 : s.lastResult === "fail" ? "fail"
                                 : s.lastResult === "pending" ? "warn" : "idle";
                    return (
                      <div key={s.id} className={"subsys " + health}>
                        <div className="bar" />
                        <div className="name">{s.id}</div>
                        <div className="note">{s.lastTitle || "—"}</div>
                        <div className="last">{s.count} test{s.count === 1 ? "" : "s"}</div>
                      </div>
                    );
                  })}
                </div>
              )}
              <div className="legend">
                <span><span className="lh ok" />pass</span>
                <span><span className="lh warn" />pending</span>
                <span><span className="lh fail" />fail</span>
                <span><span className="lh idle" />no tests</span>
              </div>
            </div>

            <div className="card">
              <div className="card-head">
                <h3>Components</h3>
                <button className="btn ghost sm" onClick={() => setRoute("components")}>
                  <Icons.Open size={11} />
                </button>
              </div>
              <div className="status-stack">
                {componentStatus.map(b => (
                  <div className="status-row" key={b.status}>
                    <span className={"status-chip " + b.status}>{b.status}</span>
                    <div className="status-bar">
                      <span style={{ width: counts.components > 0 ? `${(b.count / counts.components) * 100}%` : "0%" }} />
                    </div>
                    <span className="status-n">{b.count}</span>
                  </div>
                ))}
              </div>
              <div className="cost-mini">
                <div>
                  <span className="micro">Committed</span>
                  <div className="mono-big">£{budget.committed.toFixed(2)}</div>
                </div>
                <div style={{ textAlign: "right" }}>
                  <span className="micro">of cap</span>
                  <div className="mono-big">£{budget.cap.toFixed(2)}</div>
                </div>
                <div className="cap-bar" style={{ gridColumn: "1 / -1" }}>
                  <span style={{ width: `${budget.pct * 100}%` }} />
                </div>
              </div>
            </div>

            <div className="card span-2">
              <div className="card-head">
                <h3>Recent decisions</h3>
                <button className="btn ghost sm" onClick={() => setRoute("decisions")}>
                  <span>Decision log</span><Icons.Open size={11} />
                </button>
              </div>
              {recentDecisions.length === 0 ? (
                <div style={{ padding: 16, color: "var(--text-muted)", textAlign: "center" }}>
                  No decisions logged yet.
                </div>
              ) : (
                <div className="decision-mini">
                  {recentDecisions.map(d => (
                    <div key={d._id} className="dm-row">
                      <span className="dm-date">{new Date(d.createdAt).toISOString().slice(5, 10)}</span>
                      <span className="dm-id">{d.decisionId}</span>
                      <span className="dm-title">{d.title}</span>
                      {d.tags[0] && <span className={"tag " + d.tags[0]}>{d.tags[0]}</span>}
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="card">
              <div className="card-head">
                <h3>Quick links</h3>
              </div>
              <div style={{ display: "grid", gap: 6 }}>
                <button className="btn sm" style={{ justifyContent: "flex-start" }} onClick={() => setRoute("docs")}>
                  <Icons.Folder size={11} /><span>Upload a document</span>
                </button>
                <button className="btn sm" style={{ justifyContent: "flex-start" }} onClick={() => setRoute("chat")}>
                  <Icons.Chat size={11} /><span>Ask the assistant</span>
                </button>
                <button className="btn sm" style={{ justifyContent: "flex-start" }} onClick={() => setRoute("memory")}>
                  <Icons.Memory size={11} /><span>Edit project memory</span>
                </button>
              </div>
            </div>

            <div className="card span-2">
              <div className="card-head">
                <h3>Recent activity</h3>
                <span className="micro">latest 10</span>
              </div>
              {recentActivity.length === 0 ? (
                <div style={{ padding: 16, color: "var(--text-muted)", textAlign: "center" }}>
                  No activity yet.
                </div>
              ) : (
                <div className="activity">
                  {recentActivity.map((a, i) => (
                    <div key={i} className="act-row">
                      <span className="act-ts">{relativeTime(a.ts)}</span>
                      <span className={"act-who " + a.who}>{a.who === "ai" ? "AI" : "you"}</span>
                      <span>{a.what}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="card">
              <div className="card-head">
                <h3>Latest tests</h3>
                <button className="btn ghost sm" onClick={() => setRoute("tests")}>
                  <Icons.Open size={11} />
                </button>
              </div>
              {recentTests.length === 0 ? (
                <div style={{ padding: 16, color: "var(--text-muted)", textAlign: "center" }}>
                  No tests recorded.
                </div>
              ) : (
                <div className="test-mini">
                  {recentTests.slice(0, 3).map(t => (
                    <div key={t._id} className="tm-row">
                      <span className="tm-id">{t.testId}</span>
                      <span className="tm-title">{t.title}</span>
                      {t.metrics[0] && (
                        <span className="tm-metric">
                          {t.metrics[0].value}
                          <span style={{ color: "var(--text-faint)", marginLeft: 2 }}>
                            {t.metrics[0].unit ?? ""}
                          </span>
                        </span>
                      )}
                      <span className="tm-ts">{new Date(t.testedAt).toISOString().slice(5, 10)}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

        </div>
      </div>
    </>
  );
}
