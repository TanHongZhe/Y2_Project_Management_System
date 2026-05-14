'use client';

import React, { useState, useMemo } from 'react';
import { useQuery, useMutation } from 'convex/react';
import { api } from '../../../convex/_generated/api';
import { Doc, Id } from '../../../convex/_generated/dataModel';
import * as Icons from '../Icons';

const BUDGET_CAP = 60.0;
type SortKey = "ref" | "name" | "model" | "supplier" | "status" | "estCost";
type StatusKey = "planned" | "ordered" | "received" | "installed";

function SortableTh({
  label,
  k,
  align,
  sort,
  onSort,
}: {
  label: string;
  k: SortKey;
  align?: string;
  sort: { key: SortKey; dir: 1 | -1 };
  onSort: (k: SortKey) => void;
}) {
  return (
    <th
      onClick={() => onSort(k)}
      style={align ? { textAlign: align as React.CSSProperties["textAlign"] } : undefined}
    >
      {label}
      {sort.key === k && <span className="sort">{sort.dir > 0 ? "↑" : "↓"}</span>}
    </th>
  );
}

export default function Components() {
  const components = useQuery(api.components.list, { limit: 500 });
  const create = useMutation(api.components.create);
  const update = useMutation(api.components.update);
  const remove = useMutation(api.components.remove);

  const [sort, setSort] = useState<{ key: SortKey; dir: 1 | -1 }>({ key: "ref", dir: 1 });
  const [filter, setFilter] = useState<"all" | StatusKey>("all");
  const [query, setQuery] = useState("");
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ name: "", qty: "1", estCost: "", supplier: "", model: "", specs: "" });

  const list = useMemo(() => components ?? [], [components]);

  const filtered = useMemo(() => {
    let xs = [...list];
    if (filter !== "all") xs = xs.filter(c => c.status === filter);
    if (query) {
      const q = query.toLowerCase();
      xs = xs.filter(c =>
        (c.name + (c.model ?? "") + (c.supplier ?? "") + (c.specs ?? "")).toLowerCase().includes(q),
      );
    }
    xs.sort((a, b) => {
      const av = a[sort.key as keyof Doc<"components">];
      const bv = b[sort.key as keyof Doc<"components">];
      if (typeof av === "number" && typeof bv === "number") return (av - bv) * sort.dir;
      return String(av ?? "").localeCompare(String(bv ?? "")) * sort.dir;
    });
    return xs;
  }, [list, sort, filter, query]);

  const spent = list.filter(c => c.status !== "planned").reduce((s, c) => s + c.estCost * c.qty, 0);
  const committed = list.reduce((s, c) => s + c.estCost * c.qty, 0);
  const remain = BUDGET_CAP - spent;
  const pct = Math.min(1, spent / BUDGET_CAP);

  function toggleSort(key: SortKey) {
    setSort(s => ({ key, dir: s.key === key ? (s.dir === 1 ? -1 : 1) : 1 }));
  }

  const statusCounts: Record<string, number> = {
    all: list.length,
    installed: list.filter(c => c.status === "installed").length,
    received: list.filter(c => c.status === "received").length,
    ordered: list.filter(c => c.status === "ordered").length,
    planned: list.filter(c => c.status === "planned").length,
  };

  async function submit() {
    const name = form.name.trim();
    const qty = Number(form.qty);
    const estCost = Number(form.estCost);
    if (!name || !Number.isFinite(qty) || !Number.isFinite(estCost)) return;
    await create({
      name,
      qty,
      estCost,
      supplier: form.supplier.trim() || undefined,
      model: form.model.trim() || undefined,
      specs: form.specs.trim() || undefined,
      tags: [],
    });
    setForm({ name: "", qty: "1", estCost: "", supplier: "", model: "", specs: "" });
    setShowForm(false);
  }

  async function cycleStatus(id: Id<"components">, current: StatusKey) {
    const order: StatusKey[] = ["planned", "ordered", "received", "installed"];
    const idx = order.indexOf(current);
    const next = order[(idx + 1) % order.length];
    await update({ id, status: next });
  }

  if (!components) {
    return (
      <>
        <header className="screen-header">
          <div className="title-block">
            <div className="crumb">Workspace · Component Register</div>
            <h1>Components</h1>
          </div>
        </header>
        <div className="body"><div style={{ padding: 40, color: "var(--text-muted)" }}>Loading…</div></div>
      </>
    );
  }

  return (
    <>
      <header className="screen-header">
        <div className="title-block">
          <div className="crumb">Workspace · Component Register</div>
          <h1>
            Components{" "}
            <span style={{ fontFamily: "var(--font-mono)", fontSize: 12, color: "var(--text-faint)", marginLeft: 8 }}>
              {list.length} parts · £{committed.toFixed(2)} committed
            </span>
          </h1>
        </div>
        <div className="actions">
          <button className="btn primary sm" onClick={() => setShowForm(s => !s)}>
            <Icons.Plus /><span>Add part</span>
          </button>
        </div>
      </header>

      <div className="body">
        {showForm && (
          <div className="card" style={{ marginBottom: 16, padding: 16 }}>
            <h3 style={{ marginTop: 0 }}>New part</h3>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
              <input className="input" placeholder="Part name" value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} />
              <input className="input" placeholder="Model / MPN" value={form.model} onChange={e => setForm({ ...form, model: e.target.value })} />
              <input className="input" type="number" placeholder="Qty" value={form.qty} onChange={e => setForm({ ...form, qty: e.target.value })} />
              <input className="input" type="number" step="0.01" placeholder="Est cost (£)" value={form.estCost} onChange={e => setForm({ ...form, estCost: e.target.value })} />
              <input className="input" placeholder="Supplier" value={form.supplier} onChange={e => setForm({ ...form, supplier: e.target.value })} />
              <input className="input" placeholder="Specs" value={form.specs} onChange={e => setForm({ ...form, specs: e.target.value })} />
            </div>
            <div style={{ display: "flex", gap: 6, marginTop: 8 }}>
              <button className="btn primary sm" onClick={submit}>Save</button>
              <button className="btn ghost sm" onClick={() => setShowForm(false)}>Cancel</button>
            </div>
          </div>
        )}

        <div className="table-wrap">
          <div className="filter-row">
            <div className="search">
              <Icons.Search />
              <input
                placeholder="Search parts, models, suppliers…"
                value={query}
                onChange={e => setQuery(e.target.value)}
              />
            </div>
            <div className="chip-group">
              {(["all", "installed", "received", "ordered", "planned"] as const).map(k => (
                <button
                  key={k}
                  className={"chip" + (filter === k ? " active" : "")}
                  onClick={() => setFilter(k)}
                >
                  {k.charAt(0).toUpperCase() + k.slice(1)}{" "}
                  <span style={{ opacity: 0.5, marginLeft: 4 }}>{statusCounts[k]}</span>
                </button>
              ))}
            </div>
          </div>

          <table className="data-table">
            <thead>
              <tr>
                <SortableTh label="Ref" k="ref" sort={sort} onSort={toggleSort} />
                <SortableTh label="Part" k="name" sort={sort} onSort={toggleSort} />
                <SortableTh label="Model" k="model" sort={sort} onSort={toggleSort} />
                <SortableTh label="Supplier" k="supplier" sort={sort} onSort={toggleSort} />
                <th>Key specs</th>
                <SortableTh label="Status" k="status" sort={sort} onSort={toggleSort} />
                <SortableTh label="Cost (£)" k="estCost" align="right" sort={sort} onSort={toggleSort} />
                <th style={{ width: 36 }}></th>
              </tr>
            </thead>
            <tbody>
              {filtered.map(c => (
                <tr key={c._id}>
                  <td className="mono" style={{ color: "var(--text-muted)" }}>{c.ref}</td>
                  <td>{c.name}{c.qty > 1 ? <span style={{ color: "var(--text-faint)", marginLeft: 6 }}>×{c.qty}</span> : null}</td>
                  <td className="mono">{c.model ?? "—"}</td>
                  <td>{c.supplier ?? "—"}</td>
                  <td className="mono" style={{ color: "var(--text-muted)" }}>{c.specs ?? "—"}</td>
                  <td>
                    <button
                      className={"status-chip " + c.status}
                      onClick={() => cycleStatus(c._id, c.status)}
                      style={{ cursor: "pointer", border: "none" }}
                      title="Click to advance status"
                    >
                      {c.status}
                    </button>
                  </td>
                  <td className="mono right">{(c.estCost * c.qty).toFixed(2)}</td>
                  <td className="right">
                    <button className="btn ghost icon-only row-actions" title="Delete" onClick={() => remove({ id: c._id })}>
                      <Icons.Trash />
                    </button>
                  </td>
                </tr>
              ))}
              {filtered.length === 0 && (
                <tr>
                  <td colSpan={8} style={{ textAlign: "center", padding: "40px 0", color: "var(--text-muted)" }}>
                    {list.length === 0 ? "No parts yet. Add one above." : "No parts match this filter."}
                  </td>
                </tr>
              )}
            </tbody>
          </table>

          <div className="cost-footer">
            <div className="cell">
              <span className="l">Spent</span>
              <span className="v">£{spent.toFixed(2)}</span>
            </div>
            <div className="cell">
              <span className="l">Budget cap</span>
              <span className="v">£{BUDGET_CAP.toFixed(2)}</span>
            </div>
            <div className="cell">
              <span className="l">Remaining</span>
              <span className={"v" + (remain < 0 ? " over" : "")}>£{remain.toFixed(2)}</span>
            </div>
            <div className={"progress" + (pct > 0.85 ? " warn" : "")}>
              <span style={{ width: `${pct * 100}%` }} />
            </div>
            <div className="cell" style={{ alignItems: "flex-end" }}>
              <span className="l">Used</span>
              <span className="v">{Math.round(pct * 100)}%</span>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
