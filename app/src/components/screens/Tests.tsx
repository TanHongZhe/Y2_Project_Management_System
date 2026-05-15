'use client';

import React, { useState, useMemo } from 'react';
import { useQuery, useMutation } from 'convex/react';
import { api } from '../../../convex/_generated/api';
import * as Icons from '../Icons';

const KNOWN_SUBS = [
  { id: "pv", name: "PV + MPPT", sub: "panel + U1" },
  { id: "supercap", name: "Supercap stack", sub: "balancing" },
  { id: "bus", name: "Bus regulator", sub: "3.30 V rail" },
  { id: "led", name: "LED driver", sub: "U3" },
  { id: "comms", name: "Comms / I²C", sub: "MCU bus" },
  { id: "system", name: "System integration", sub: "end-to-end" },
];

export default function Tests({ readOnly, searchBar }: { readOnly?: boolean; searchBar?: React.ReactNode }) {
  const tests = useQuery(api.tests.list, { limit: 500 });
  const create = useMutation(api.tests.create);
  const remove = useMutation(api.tests.remove);

  const [sub, setSub] = useState("all");
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({
    title: "",
    subsystem: "pv",
    result: "pending" as "pass" | "fail" | "pending",
    conditions: "",
    notes: "",
    metrics: "",
  });

  const all = useMemo(() => tests ?? [], [tests]);
  const filtered = useMemo(
    () => (sub === "all" ? all : all.filter(t => t.subsystem === sub)),
    [all, sub],
  );

  const counts = useMemo(() => {
    const map: Record<string, number> = { all: all.length };
    for (const s of KNOWN_SUBS) map[s.id] = all.filter(t => t.subsystem === s.id).length;
    for (const t of all) {
      if (!(t.subsystem in map)) map[t.subsystem] = (map[t.subsystem] ?? 0) + 1;
    }
    return map;
  }, [all]);

  async function submit() {
    if (!form.title.trim()) return;
    const metrics = form.metrics
      .split("\n")
      .map(line => line.trim())
      .filter(Boolean)
      .map(line => {
        const parts = line.split(/\s*[=:]\s*/);
        if (parts.length < 2) return { key: line, value: "" };
        const valueAndUnit = parts.slice(1).join("=").trim();
        const m = /^(\S+)\s+(.+)$/.exec(valueAndUnit);
        if (m) return { key: parts[0].trim(), value: m[1], unit: m[2] };
        return { key: parts[0].trim(), value: valueAndUnit };
      });
    await create({
      title: form.title.trim(),
      subsystem: form.subsystem.trim() || "system",
      result: form.result,
      conditions: form.conditions.trim() || undefined,
      notes: form.notes.trim() || undefined,
      metrics,
    });
    setForm({ title: "", subsystem: "pv", result: "pending", conditions: "", notes: "", metrics: "" });
    setShowForm(false);
  }

  if (!tests) {
    return (
      <>
        <header className="screen-header">
          <div className="title-block">
            <div className="crumb">Workspace · Test Results</div>
            <h1>Test log</h1>
          </div>
        </header>
        <div className="body"><div style={{ padding: 40, color: "var(--text-muted)" }}>Loading…</div></div>
      </>
    );
  }

  const subInfo = KNOWN_SUBS.find(s => s.id === sub);

  return (
    <>
      <header className="screen-header">
        <div className="title-block">
          <div className="crumb">Workspace · Test Results</div>
          <h1>
            Test log{" "}
            <span style={{ fontFamily: "var(--font-mono)", fontSize: 12, color: "var(--text-faint)", marginLeft: 8 }}>
              {all.length} entries
            </span>
          </h1>
        </div>
        <div className="actions">
          {searchBar}
          {!readOnly && (
            <button className="btn primary sm" onClick={() => setShowForm(s => !s)}>
              <Icons.Plus /><span>New test</span>
            </button>
          )}
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
              <span className="sub">total {all.length}</span>
            </div>
            <span className="count">{all.length}</span>
          </div>
          {KNOWN_SUBS.map(s => (
            <div
              key={s.id}
              className={"subsystem" + (sub === s.id ? " active" : "")}
              onClick={() => setSub(s.id)}
            >
              <div>
                <div>{s.name}</div>
                <span className="sub">{s.sub}</span>
              </div>
              <span className="count">{counts[s.id] ?? 0}</span>
            </div>
          ))}
        </aside>

        <div className="tests-list">
          {showForm && !readOnly && (
            <div className="card" style={{ marginBottom: 14, padding: 16 }}>
              <h3 style={{ marginTop: 0 }}>New test result</h3>
              <div style={{ display: "grid", gap: 8 }}>
                <input className="input" placeholder="Title" value={form.title} onChange={e => setForm({ ...form, title: e.target.value })} />
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
                  <select
                    className="input"
                    value={form.subsystem}
                    onChange={e => setForm({ ...form, subsystem: e.target.value })}
                  >
                    {KNOWN_SUBS.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                  </select>
                  <select
                    className="input"
                    value={form.result}
                    onChange={e => setForm({ ...form, result: e.target.value as typeof form.result })}
                  >
                    <option value="pass">pass</option>
                    <option value="fail">fail</option>
                    <option value="pending">pending</option>
                  </select>
                </div>
                <textarea className="input" placeholder="Conditions" value={form.conditions} onChange={e => setForm({ ...form, conditions: e.target.value })} style={{ minHeight: 60 }} />
                <textarea
                  className="input"
                  placeholder={"Metrics — one per line, e.g.\nV_mp = 6.20 V\nI_mp = 0.42 A"}
                  value={form.metrics}
                  onChange={e => setForm({ ...form, metrics: e.target.value })}
                  style={{ minHeight: 70, fontFamily: "var(--font-mono)", fontSize: 12 }}
                />
                <textarea className="input" placeholder="Notes" value={form.notes} onChange={e => setForm({ ...form, notes: e.target.value })} style={{ minHeight: 60 }} />
                <div style={{ display: "flex", gap: 6 }}>
                  <button className="btn primary sm" onClick={submit}>Save</button>
                  <button className="btn ghost sm" onClick={() => setShowForm(false)}>Cancel</button>
                </div>
              </div>
            </div>
          )}

          {subInfo && (
            <div style={{ marginBottom: 14, padding: "12px 14px", border: "1px solid var(--line)", borderRadius: 6, background: "var(--bg-elev)" }}>
              <div style={{ fontFamily: "var(--font-mono)", fontSize: 10, letterSpacing: "0.06em", textTransform: "uppercase", color: "var(--text-faint)" }}>
                Subsystem
              </div>
              <div style={{ fontSize: 15, fontWeight: 500, marginTop: 2 }}>{subInfo.name}</div>
              <div style={{ color: "var(--text-muted)", fontSize: 12.5, marginTop: 4 }}>
                {subInfo.sub} · {counts[subInfo.id] ?? 0} tests on record
              </div>
            </div>
          )}

          {filtered.map(t => (
            <div className="test-card" key={t._id}>
              <div className="head">
                <span style={{ fontFamily: "var(--font-mono)", fontSize: 11, color: "var(--text-faint)" }}>{t.testId}</span>
                <div className="t">{t.title}</div>
                <span className={"status-chip " + (t.result === "pass" ? "installed" : t.result === "fail" ? "ordered" : "planned")} style={{ marginLeft: 6 }}>
                  {t.result}
                </span>
                <span className="ts">{new Date(t.testedAt).toISOString().slice(0, 16).replace("T", " ")}</span>
                <span className="author">{t.author === "ai" ? "ai-logged" : t.author}</span>
                {!readOnly && (
                  <button className="btn ghost icon-only" onClick={() => remove({ id: t._id })} title="Delete" style={{ marginLeft: "auto" }}>
                    <Icons.Trash />
                  </button>
                )}
              </div>
              <div className="body-t">
                <div className="col">
                  {t.conditions && (<>
                    <h5>Conditions</h5>
                    <p>{t.conditions}</p>
                  </>)}
                  {t.notes && (<>
                    <h5 style={{ marginTop: 12 }}>Notes</h5>
                    <p>{t.notes}</p>
                  </>)}
                  {!t.conditions && !t.notes && (
                    <p style={{ color: "var(--text-faint)" }}>No conditions or notes.</p>
                  )}
                </div>
                <div className="col">
                  <h5>Measurements</h5>
                  {t.metrics.length === 0 ? (
                    <p style={{ color: "var(--text-faint)" }}>No metrics recorded.</p>
                  ) : (
                    <div className="metrics">
                      {t.metrics.map((m, i) => (
                        <div className="metric" key={i}>
                          <div className="ml">{m.key}</div>
                          <div className="mv">{m.value} <span className="unit">{m.unit ?? ""}</span></div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </div>
          ))}

          {filtered.length === 0 && !showForm && (
            <div style={{ textAlign: "center", padding: "60px 0", color: "var(--text-muted)" }}>
              {all.length === 0
                ? "No tests recorded yet. Click New test or ask the assistant in chat."
                : "No tests recorded for this subsystem yet."}
            </div>
          )}
        </div>
      </div>
    </>
  );
}
