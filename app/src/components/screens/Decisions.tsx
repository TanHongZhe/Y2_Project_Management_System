'use client';

import React, { useState, useMemo } from 'react';
import { useQuery, useMutation } from 'convex/react';
import { api } from '../../../convex/_generated/api';
import { Id } from '../../../convex/_generated/dataModel';
import * as Icons from '../Icons';

const KNOWN_TAGS = ["arch", "bus", "pv", "bom", "cost", "firmware"];

export default function Decisions() {
  const decisions = useQuery(api.decisions.list, { limit: 200 });
  const create = useMutation(api.decisions.create);
  const update = useMutation(api.decisions.update);
  const remove = useMutation(api.decisions.remove);

  const [filter, setFilter] = useState("all");
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ title: "", rationale: "", tags: "" });

  // Inline edit state
  const [editingId, setEditingId] = useState<Id<"decisions"> | null>(null);
  const [editForm, setEditForm] = useState({ title: "", rationale: "", tags: "" });

  const list = useMemo(() => decisions ?? [], [decisions]);

  const filtered = useMemo(() => {
    if (filter === "all") return list;
    return list.filter(d => d.tags.includes(filter));
  }, [list, filter]);

  const counts: Record<string, number> = useMemo(() => {
    const out: Record<string, number> = { all: list.length };
    for (const tag of KNOWN_TAGS) {
      out[tag] = list.filter(d => d.tags.includes(tag)).length;
    }
    return out;
  }, [list]);

  async function submit() {
    const title = form.title.trim();
    const rationale = form.rationale.trim();
    if (!title || !rationale) return;
    const tags = form.tags.split(",").map(t => t.trim()).filter(Boolean);
    await create({ title, rationale, tags });
    setForm({ title: "", rationale: "", tags: "" });
    setShowForm(false);
  }

  function startEdit(d: { _id: Id<"decisions">; title: string; rationale: string; tags: string[] }) {
    setEditingId(d._id);
    setEditForm({ title: d.title, rationale: d.rationale, tags: d.tags.join(", ") });
  }

  async function saveEdit() {
    if (!editingId) return;
    const title = editForm.title.trim();
    const rationale = editForm.rationale.trim();
    if (!title || !rationale) return;
    const tags = editForm.tags.split(",").map(t => t.trim()).filter(Boolean);
    await update({ id: editingId, title, rationale, tags });
    setEditingId(null);
  }

  if (!decisions) {
    return (
      <>
        <header className="screen-header">
          <div className="title-block">
            <div className="crumb">Workspace · Decision Log</div>
            <h1>Decisions</h1>
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
          <div className="crumb">Workspace · Decision Log</div>
          <h1>
            Decisions{" "}
            <span style={{ fontFamily: "var(--font-mono)", fontSize: 12, color: "var(--text-faint)", marginLeft: 8 }}>
              {list.length} entries · newest first
            </span>
          </h1>
        </div>
        <div className="actions">
          <button className="btn primary sm" onClick={() => setShowForm(s => !s)}>
            <Icons.Plus /><span>Log decision</span>
          </button>
        </div>
      </header>

      <div style={{ padding: "16px 32px 0", display: "flex", gap: 6, flexWrap: "wrap", borderBottom: "1px solid var(--line)" }}>
        <button className={"chip" + (filter === "all" ? " active" : "")} onClick={() => setFilter("all")} style={{ marginBottom: 12 }}>
          All <span style={{ opacity: 0.5, marginLeft: 4 }}>{counts.all}</span>
        </button>
        {KNOWN_TAGS.map(tag => (
          <button key={tag} className={"chip" + (filter === tag ? " active" : "")} onClick={() => setFilter(tag)} style={{ marginBottom: 12 }}>
            {tag.toUpperCase()} <span style={{ opacity: 0.5, marginLeft: 4 }}>{counts[tag] ?? 0}</span>
          </button>
        ))}
      </div>

      <div className="body">
        {showForm && (
          <div className="card" style={{ marginBottom: 16, padding: 16, maxWidth: 780, margin: "16px auto" }}>
            <h3 style={{ marginTop: 0 }}>New decision</h3>
            <div style={{ display: "grid", gap: 8 }}>
              <input className="input" placeholder="Title" value={form.title} onChange={e => setForm({ ...form, title: e.target.value })} />
              <textarea className="input" placeholder="Rationale — why are we doing this?" value={form.rationale} onChange={e => setForm({ ...form, rationale: e.target.value })} style={{ minHeight: 80, resize: "vertical" }} />
              <input className="input" placeholder="Tags (comma separated, e.g. bus, cost)" value={form.tags} onChange={e => setForm({ ...form, tags: e.target.value })} />
              <div style={{ display: "flex", gap: 6 }}>
                <button className="btn primary sm" onClick={submit}>Save</button>
                <button className="btn ghost sm" onClick={() => setShowForm(false)}>Cancel</button>
              </div>
            </div>
          </div>
        )}

        <div className="decision-list">
          {filtered.map(d => (
            <div className="decision" key={d._id}>
              {editingId === d._id ? (
                <>
                  <div className="left">
                    <span className="date">{new Date(d.createdAt).toISOString().slice(0, 10)}</span>
                    <span className="id">{d.decisionId}</span>
                  </div>
                  <div className="right" style={{ display: "grid", gap: 8 }}>
                    <input className="input" value={editForm.title} onChange={e => setEditForm({ ...editForm, title: e.target.value })} placeholder="Title" />
                    <textarea className="input" value={editForm.rationale} onChange={e => setEditForm({ ...editForm, rationale: e.target.value })} placeholder="Rationale" style={{ minHeight: 60, resize: "vertical" }} />
                    <input className="input" value={editForm.tags} onChange={e => setEditForm({ ...editForm, tags: e.target.value })} placeholder="Tags (comma separated)" />
                    <div style={{ display: "flex", gap: 6 }}>
                      <button className="btn primary sm" onClick={saveEdit}>Save</button>
                      <button className="btn ghost sm" onClick={() => setEditingId(null)}>Cancel</button>
                    </div>
                  </div>
                </>
              ) : (
                <>
                  <div className="left">
                    <span className="date">{new Date(d.createdAt).toISOString().slice(0, 10)}</span>
                    <span className="id">{d.decisionId}</span>
                  </div>
                  <div className="right">
                    <div style={{ display: "flex", alignItems: "flex-start", gap: 8 }}>
                      <div className="title" style={{ flex: 1 }}>{d.title}</div>
                      <div className="decision-actions">
                        <button className="btn ghost icon-only sm" title="Edit" onClick={() => startEdit(d)}>
                          <Icons.Edit size={12} />
                        </button>
                        <button className="btn ghost icon-only sm" title="Delete" onClick={() => remove({ id: d._id })}>
                          <Icons.Trash />
                        </button>
                      </div>
                    </div>
                    <div className="why">{d.rationale}</div>
                    <div className="tags">
                      {d.tags.map(t => <span key={t} className={"tag " + t}>{t}</span>)}
                    </div>
                  </div>
                </>
              )}
            </div>
          ))}
          {filtered.length === 0 && (
            <div style={{ textAlign: "center", padding: "60px 0", color: "var(--text-muted)" }}>
              {list.length === 0
                ? "No decisions logged yet. Log one above, or ask the assistant in chat."
                : "No decisions match this filter."}
            </div>
          )}
        </div>
      </div>
    </>
  );
}
