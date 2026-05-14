'use client';

import React, { useState } from 'react';
import { AppData } from '@/lib/data';
import * as Icons from '../Icons';

interface TestsProps {
  data: AppData;
}

export default function Tests({ data }: TestsProps) {
  const [sub, setSub] = useState("all");
  const tests = sub === "all" ? data.tests : data.tests.filter(t => t.subsystem === sub);
  const subInfo = data.testSubsystems.find(s => s.id === sub);

  return (
    <>
      <header className="screen-header">
        <div className="title-block">
          <div className="crumb">Workspace · Test Results</div>
          <h1>Test log <span style={{ fontFamily: "var(--font-mono)", fontSize: 12, color: "var(--text-faint)", marginLeft: 8 }}>{data.tests.length} entries · last 7 days</span></h1>
        </div>
        <div className="actions">
          <button className="btn ghost sm"><Icons.Clock /><span>Last 30 days</span></button>
          <button className="btn sm"><Icons.Download /><span>Export</span></button>
          <button className="btn primary sm"><Icons.Plus /><span>New test</span></button>
        </div>
      </header>

      <div className="tests-grid">
        <aside className="tests-side">
          <h3>Subsystem</h3>
          <div
            className={"subsystem" + (sub === "all" ? " active" : "")}
            onClick={() => setSub("all")}
          >
            <div>
              <div>All subsystems</div>
              <span className="sub">total {data.tests.length}</span>
            </div>
            <span className="count">{data.tests.length}</span>
          </div>
          {data.testSubsystems.map(s => (
            <div
              key={s.id}
              className={"subsystem" + (sub === s.id ? " active" : "")}
              onClick={() => setSub(s.id)}
            >
              <div>
                <div>{s.name}</div>
                <span className="sub">{s.sub}</span>
              </div>
              <span className="count">{s.count}</span>
            </div>
          ))}

          <h3 style={{ marginTop: 22 }}>Range</h3>
          <div className="subsystem"><div>Last 7 days</div><span className="count">5</span></div>
          <div className="subsystem"><div>Last 30 days</div><span className="count">21</span></div>
          <div className="subsystem"><div>All time</div><span className="count">21</span></div>
        </aside>

        <div className="tests-list">
          {subInfo && (
            <div style={{ marginBottom: 14, padding: "12px 14px", border: "1px solid var(--line)", borderRadius: 6, background: "var(--bg-elev)" }}>
              <div style={{ fontFamily: "var(--font-mono)", fontSize: 10, letterSpacing: "0.06em", textTransform: "uppercase", color: "var(--text-faint)" }}>
                Subsystem
              </div>
              <div style={{ fontSize: 15, fontWeight: 500, marginTop: 2 }}>{subInfo.name}</div>
              <div style={{ color: "var(--text-muted)", fontSize: 12.5, marginTop: 4 }}>{subInfo.sub} · {subInfo.count} tests on record</div>
            </div>
          )}

          {tests.map(t => (
            <div className="test-card" key={t.id}>
              <div className="head">
                <span style={{ fontFamily: "var(--font-mono)", fontSize: 11, color: "var(--text-faint)" }}>{t.id}</span>
                <div className="t">{t.title}</div>
                <span className="ts">{t.date}</span>
                <span className="author">{t.author === "ai" ? "ai-logged" : t.author}</span>
              </div>
              <div className="body-t">
                <div className="col">
                  <h5>Conditions</h5>
                  <p>{t.conditions}</p>
                  <h5 style={{ marginTop: 12 }}>Notes</h5>
                  <p>{t.notes}</p>
                </div>
                <div className="col">
                  <h5>Measurements</h5>
                  <div className="metrics">
                    {t.metrics.map(([k, v, u], i) => (
                      <div className="metric" key={i}>
                        <div className="ml">{k}</div>
                        <div className="mv">{v} <span className="unit">{u}</span></div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          ))}

          {tests.length === 0 && (
            <div style={{ textAlign: "center", padding: "60px 0", color: "var(--text-muted)" }}>
              No tests recorded for this subsystem yet.
            </div>
          )}
        </div>
      </div>
    </>
  );
}
