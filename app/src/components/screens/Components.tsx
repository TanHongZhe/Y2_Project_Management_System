'use client';

import React, { useState, useMemo, useCallback, useRef, DragEvent } from 'react';
import { useQuery, useMutation, useAction } from 'convex/react';
import { api } from '../../../convex/_generated/api';
import { Doc, Id } from '../../../convex/_generated/dataModel';
import * as Icons from '../Icons';

type SortKey = "name" | "model" | "supplier" | "status" | "estCost" | "qty";
type StatusKey = "planned" | "ordered" | "received" | "installed";

function SortableTh({
  label, k, align, sort, onSort,
}: {
  label: string; k: SortKey; align?: string;
  sort: { key: SortKey; dir: 1 | -1 }; onSort: (k: SortKey) => void;
}) {
  return (
    <th onClick={() => onSort(k)} style={align ? { textAlign: align as React.CSSProperties["textAlign"] } : undefined}>
      {label}
      {sort.key === k && <span className="sort">{sort.dir > 0 ? "↑" : "↓"}</span>}
    </th>
  );
}

interface EditForm { name: string; qty: string; estCost: string; totalCost: string; supplier: string; model: string; }

export default function Components({ readOnly }: { readOnly?: boolean }) {
  const components = useQuery(api.components.list, { limit: 500 });
  const stats = useQuery(api.overview.stats, {});
  const create = useMutation(api.components.create);
  const update = useMutation(api.components.update);
  const remove = useMutation(api.components.remove);
  const generateUploadUrl = useMutation(api.documents.generateUploadUrl);
  const createDoc = useMutation(api.documents.create);
  const processDocument = useAction(api.ingest.processDocument);

  const budgetCap = stats?.budget?.cap ?? 60;

  const [sort, setSort] = useState<{ key: SortKey; dir: 1 | -1 }>({ key: "name", dir: 1 });
  const [filter, setFilter] = useState<"all" | StatusKey>("all");
  const [query, setQuery] = useState("");
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ name: "", qty: "1", estCost: "", totalCost: "", supplier: "", model: "" });
  const [formFile, setFormFile] = useState<File | null>(null);
  const [formDragOver, setFormDragOver] = useState(false);
  const [formSubmitting, setFormSubmitting] = useState(false);
  const [formErr, setFormErr] = useState("");
  const formFileRef = useRef<HTMLInputElement>(null);

  const [editingId, setEditingId] = useState<Id<"components"> | null>(null);
  const [editForm, setEditForm] = useState<EditForm>({ name: "", qty: "1", estCost: "", totalCost: "", supplier: "", model: "" });

  const [uploadingFor, setUploadingFor] = useState<Id<"components"> | null>(null);
  const [pdfViewing, setPdfViewing] = useState<Id<"documents"> | null>(null);
  const pdfUrl = useQuery(api.documents.getUrl, pdfViewing ? { documentId: pdfViewing } : "skip");

  const list = useMemo(() => components ?? [], [components]);

  const filtered = useMemo(() => {
    let xs = [...list];
    if (filter !== "all") xs = xs.filter(c => c.status === filter);
    if (query) {
      const q = query.toLowerCase();
      xs = xs.filter(c =>
        (c.name + (c.model ?? "") + (c.supplier ?? "")).toLowerCase().includes(q),
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
  const remain = budgetCap - committed;
  const pct = Math.min(1, committed / (budgetCap || 1));

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

  // When cost/unit or qty changes, auto-fill total cost
  function handleFormEstCost(val: string) {
    const cost = parseFloat(val);
    const qty = parseInt(form.qty, 10);
    const auto = !isNaN(cost) && !isNaN(qty) && cost > 0 && qty > 0
      ? (cost * qty).toFixed(2) : "";
    setForm(f => ({ ...f, estCost: val, totalCost: auto || f.totalCost }));
  }

  function handleFormQty(val: string) {
    const qty = parseInt(val, 10);
    const cost = parseFloat(form.estCost);
    const auto = !isNaN(cost) && !isNaN(qty) && cost > 0 && qty > 0
      ? (cost * qty).toFixed(2) : "";
    setForm(f => ({ ...f, qty: val, totalCost: auto || f.totalCost }));
  }

  const totalCostIsAuto = useMemo(() => {
    const cost = parseFloat(form.estCost);
    const qty = parseInt(form.qty, 10);
    return !isNaN(cost) && !isNaN(qty) && cost > 0 && qty > 0;
  }, [form.estCost, form.qty]);

  const uploadDatasheet = useCallback(async (componentId: Id<"components">, file: File) => {
    if (file.size > 20 * 1024 * 1024) throw new Error("File too large (max 20 MB).");
    const uploadUrl = await generateUploadUrl();
    const res = await fetch(uploadUrl, {
      method: "POST",
      headers: { "Content-Type": "application/pdf" },
      body: file,
    });
    if (!res.ok) throw new Error(`Upload failed: ${res.status}`);
    const { storageId } = (await res.json()) as { storageId: Id<"_storage"> };
    const documentId = await createDoc({ name: file.name, type: "pdf", storageId, size: file.size, group: "datasheet" });
    void processDocument({ documentId });
    await update({ id: componentId, datasheetId: documentId });
  }, [generateUploadUrl, createDoc, processDocument, update]);

  async function submit() {
    const name = form.name.trim();
    const qty = Number(form.qty);
    const totalCost = Number(form.totalCost);
    if (!name) { setFormErr("Name is required."); return; }
    if (!Number.isFinite(qty) || qty <= 0) { setFormErr("Quantity must be a positive number."); return; }
    if (!form.totalCost.trim() || !Number.isFinite(totalCost) || totalCost < 0) {
      setFormErr("Total cost is required."); return;
    }
    const estCostRaw = form.estCost.trim();
    const estCost = estCostRaw !== "" ? Number(estCostRaw) : totalCost / qty;
    setFormErr("");
    setFormSubmitting(true);
    try {
      const { docId } = await create({
        name, qty, estCost,
        supplier: form.supplier.trim() || undefined,
        model: form.model.trim() || undefined,
        tags: [],
      });
      if (formFile) {
        await uploadDatasheet(docId, formFile);
      }
      setForm({ name: "", qty: "1", estCost: "", totalCost: "", supplier: "", model: "" });
      setFormFile(null);
      if (formFileRef.current) formFileRef.current.value = "";
      setShowForm(false);
    } catch (err) {
      setFormErr(err instanceof Error ? err.message : "Failed to save.");
    } finally {
      setFormSubmitting(false);
    }
  }

  async function cycleStatus(id: Id<"components">, current: StatusKey) {
    const order: StatusKey[] = ["planned", "ordered", "received", "installed"];
    const next = order[(order.indexOf(current) + 1) % order.length];
    await update({ id, status: next });
  }

  function startEdit(c: Doc<"components">) {
    setEditingId(c._id);
    const total = (c.estCost * c.qty).toFixed(2);
    setEditForm({
      name: c.name,
      qty: String(c.qty),
      estCost: c.estCost === 0 ? "" : String(c.estCost),
      totalCost: c.estCost === 0 ? "" : total,
      supplier: c.supplier ?? "",
      model: c.model ?? "",
    });
  }

  function handleEditEstCost(val: string) {
    const cost = parseFloat(val);
    const qty = parseInt(editForm.qty, 10);
    const auto = !isNaN(cost) && !isNaN(qty) && cost > 0 && qty > 0
      ? (cost * qty).toFixed(2) : "";
    setEditForm(f => ({ ...f, estCost: val, totalCost: auto || f.totalCost }));
  }

  function handleEditQty(val: string) {
    const qty = parseInt(val, 10);
    const cost = parseFloat(editForm.estCost);
    const auto = !isNaN(cost) && !isNaN(qty) && cost > 0 && qty > 0
      ? (cost * qty).toFixed(2) : "";
    setEditForm(f => ({ ...f, qty: val, totalCost: auto || f.totalCost }));
  }

  const editTotalIsAuto = useMemo(() => {
    const cost = parseFloat(editForm.estCost);
    const qty = parseInt(editForm.qty, 10);
    return !isNaN(cost) && !isNaN(qty) && cost > 0 && qty > 0;
  }, [editForm.estCost, editForm.qty]);

  async function saveEdit(id: Id<"components">) {
    const qty = Number(editForm.qty);
    const totalCost = Number(editForm.totalCost);
    if (!Number.isFinite(qty) || qty <= 0) return;
    if (!editForm.totalCost.trim() || !Number.isFinite(totalCost)) return;
    const estCostRaw = editForm.estCost.trim();
    const estCost = estCostRaw !== "" ? Number(estCostRaw) : totalCost / qty;
    await update({ id, qty, estCost, supplier: editForm.supplier.trim() || undefined, model: editForm.model.trim() || undefined });
    setEditingId(null);
  }

  const handleDatasheetUpload = useCallback(async (componentId: Id<"components">, file: File) => {
    if (!file.name.toLowerCase().endsWith(".pdf")) {
      alert("Only PDF files are supported for datasheets.");
      return;
    }
    setUploadingFor(componentId);
    try {
      await uploadDatasheet(componentId, file);
    } catch (err) {
      alert(err instanceof Error ? err.message : "Upload failed");
    } finally {
      setUploadingFor(null);
    }
  }, [uploadDatasheet]);

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
        {!readOnly && (
          <div className="actions">
            <button className="btn primary sm" onClick={() => setShowForm(s => !s)}>
              <Icons.Plus /><span>Add part</span>
            </button>
          </div>
        )}
      </header>

      <div className="body">
        {showForm && (
          <div className="card" style={{ marginBottom: 16, padding: 16 }}>
            <h3 style={{ marginTop: 0 }}>New part</h3>
            {formErr && <p style={{ color: "var(--danger)", fontSize: 12, margin: "0 0 8px" }}>{formErr}</p>}
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
              {/* Name */}
              <div>
                <label style={{ fontSize: 11, color: "var(--text-muted)", display: "block", marginBottom: 3 }}>
                  Name <span style={{ color: "var(--danger)" }}>*</span>
                </label>
                <input
                  className="input"
                  placeholder="e.g. Opamp"
                  value={form.name}
                  onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                  style={{ width: "100%" }}
                />
              </div>
              {/* Model */}
              <div>
                <label style={{ fontSize: 11, color: "var(--text-muted)", display: "block", marginBottom: 3 }}>
                  Model number <span style={{ color: "var(--danger)" }}>*</span>
                </label>
                <input
                  className="input"
                  placeholder="e.g. MCP6001"
                  value={form.model}
                  onChange={e => setForm(f => ({ ...f, model: e.target.value }))}
                  style={{ width: "100%" }}
                />
              </div>
              {/* Quantity */}
              <div>
                <label style={{ fontSize: 11, color: "var(--text-muted)", display: "block", marginBottom: 3 }}>
                  Quantity <span style={{ color: "var(--danger)" }}>*</span>
                </label>
                <input
                  className="input"
                  type="number"
                  min="1"
                  placeholder="e.g. 1"
                  value={form.qty}
                  onChange={e => handleFormQty(e.target.value)}
                  style={{ width: "100%" }}
                />
              </div>
              {/* Supplier */}
              <div>
                <label style={{ fontSize: 11, color: "var(--text-muted)", display: "block", marginBottom: 3 }}>
                  Supplier <span style={{ color: "var(--danger)" }}>*</span>
                </label>
                <input
                  className="input"
                  placeholder="e.g. Amazon"
                  value={form.supplier}
                  onChange={e => setForm(f => ({ ...f, supplier: e.target.value }))}
                  style={{ width: "100%" }}
                />
              </div>
              {/* Cost per unit */}
              <div>
                <label style={{ fontSize: 11, color: "var(--text-muted)", display: "block", marginBottom: 3 }}>
                  Cost per unit (£) <span style={{ color: "var(--text-faint)", fontSize: 10 }}>optional</span>
                </label>
                <input
                  className="input"
                  type="number"
                  step="0.01"
                  min="0"
                  placeholder="e.g. 4.20"
                  value={form.estCost}
                  onChange={e => handleFormEstCost(e.target.value)}
                  style={{ width: "100%" }}
                />
              </div>
              {/* Total cost */}
              <div style={{ position: "relative" }}>
                <label style={{ fontSize: 11, color: "var(--text-muted)", display: "block", marginBottom: 3 }}>
                  Total cost (£) <span style={{ color: "var(--danger)" }}>*</span>
                </label>
                <input
                  className="input"
                  type="number"
                  step="0.01"
                  min="0"
                  placeholder="e.g. 12.60"
                  value={form.totalCost}
                  readOnly={totalCostIsAuto}
                  onChange={e => !totalCostIsAuto && setForm(f => ({ ...f, totalCost: e.target.value }))}
                  style={{
                    width: "100%",
                    opacity: totalCostIsAuto ? 0.7 : 1,
                    cursor: totalCostIsAuto ? "default" : "text",
                  }}
                />
                {totalCostIsAuto && (
                  <span style={{
                    position: "absolute", right: 10, bottom: 9,
                    fontSize: 10, color: "var(--text-faint)", pointerEvents: "none",
                  }}>auto</span>
                )}
              </div>
              {/* Datasheet — full width */}
              <div style={{ gridColumn: "1 / -1" }}>
                <label style={{ fontSize: 11, color: "var(--text-muted)", display: "block", marginBottom: 3 }}>
                  Datasheet (PDF)
                </label>
                <div
                  className={"img-dropzone" + (formDragOver ? " drag-over" : "")}
                  style={{ padding: "10px 16px", flexDirection: "row", justifyContent: "flex-start", gap: 10, cursor: "pointer", width: "100%", boxSizing: "border-box", margin: 0 }}
                  onClick={() => !formFile && formFileRef.current?.click()}
                  onDragOver={(e: DragEvent) => { e.preventDefault(); setFormDragOver(true); }}
                  onDragLeave={() => setFormDragOver(false)}
                  onDrop={(e: DragEvent) => {
                    e.preventDefault();
                    setFormDragOver(false);
                    const f = e.dataTransfer.files?.[0];
                    if (f && f.name.toLowerCase().endsWith(".pdf")) setFormFile(f);
                    else if (f) alert("Only PDF files are supported.");
                  }}
                >
                  <input
                    ref={formFileRef}
                    type="file"
                    accept=".pdf"
                    style={{ display: "none" }}
                    onChange={e => {
                      const f = e.target.files?.[0];
                      if (f && !f.name.toLowerCase().endsWith(".pdf")) {
                        alert("Only PDF files are supported.");
                        return;
                      }
                      setFormFile(f ?? null);
                    }}
                  />
                  <div className="img-dropzone-icon"><Icons.ArrowUp size={14} /></div>
                  {formFile ? (
                    <div style={{ display: "flex", alignItems: "center", gap: 8, flex: 1 }}>
                      <Icons.Pdf />
                      <span className="img-dropzone-label" style={{ fontSize: 12 }}>{formFile.name}</span>
                      <button
                        className="btn ghost icon-only sm"
                        style={{ marginLeft: "auto" }}
                        onClick={e => { e.stopPropagation(); setFormFile(null); if (formFileRef.current) formFileRef.current.value = ""; }}
                      >
                        <Icons.X size={10} />
                      </button>
                    </div>
                  ) : (
                    <span className="img-dropzone-label" style={{ fontSize: 12 }}>
                      Drop datasheet PDF here or click to upload
                    </span>
                  )}
                </div>
              </div>
            </div>

            <div style={{ display: "flex", gap: 6, marginTop: 12, alignItems: "center" }}>
              <button className="btn primary sm" onClick={submit} disabled={formSubmitting}>
                {formSubmitting ? "Saving…" : "Save"}
              </button>
              <button className="btn ghost sm" onClick={() => { setShowForm(false); setFormErr(""); setFormFile(null); }}>
                Cancel
              </button>
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
                <button key={k} className={"chip" + (filter === k ? " active" : "")} onClick={() => setFilter(k)}>
                  {k.charAt(0).toUpperCase() + k.slice(1)}{" "}
                  <span style={{ opacity: 0.5, marginLeft: 4 }}>{statusCounts[k]}</span>
                </button>
              ))}
            </div>
          </div>

          <table className="data-table">
            <thead>
              <tr>
                <SortableTh label="Name" k="name" sort={sort} onSort={toggleSort} />
                <SortableTh label="Model" k="model" sort={sort} onSort={toggleSort} />
                <SortableTh label="Qty" k="qty" align="center" sort={sort} onSort={toggleSort} />
                <SortableTh label="Supplier" k="supplier" sort={sort} onSort={toggleSort} />
                <th>Datasheet</th>
                <SortableTh label="Status" k="status" sort={sort} onSort={toggleSort} />
                <SortableTh label="Cost/unit (£)" k="estCost" align="right" sort={sort} onSort={toggleSort} />
                <th style={{ textAlign: "right" }}>Total (£)</th>
                <th style={{ width: 60 }}></th>
              </tr>
            </thead>
            <tbody>
              {filtered.map(c => (
                <React.Fragment key={c._id}>
                  <tr>
                    <td style={{ fontWeight: 500 }}>{c.name}</td>
                    <td className="mono" style={{ color: "var(--text-muted)" }}>{c.model ?? "—"}</td>
                    <td className="mono" style={{ textAlign: "center" }}>{c.qty}</td>
                    <td>{c.supplier ?? "—"}</td>
                    <td>
                      {c.datasheetId ? (
                        <button
                          className="btn ghost icon-only sm"
                          title="View datasheet"
                          onClick={() => setPdfViewing(c.datasheetId!)}
                          style={{ color: "var(--accent-fg)" }}
                        >
                          <Icons.Pdf />
                        </button>
                      ) : !readOnly ? (
                        <label className="btn ghost sm" title="Upload datasheet (PDF)" style={{ cursor: "pointer", fontSize: 11, gap: 4 }}>
                          {uploadingFor === c._id
                            ? <span style={{ opacity: 0.5 }}>Uploading…</span>
                            : <><Icons.Plus size={10} /><span>Upload</span></>
                          }
                          <input
                            type="file"
                            accept=".pdf"
                            style={{ display: "none" }}
                            disabled={uploadingFor !== null}
                            onChange={e => {
                              const f = e.target.files?.[0];
                              if (f) void handleDatasheetUpload(c._id, f);
                              e.target.value = "";
                            }}
                          />
                        </label>
                      ) : <span style={{ color: "var(--text-faint)", fontSize: 11 }}>—</span>}
                    </td>
                    <td>
                      <button
                        className={"status-chip " + c.status}
                        onClick={readOnly ? undefined : () => cycleStatus(c._id, c.status)}
                        style={{ cursor: readOnly ? "default" : "pointer", border: "none" }}
                        title={readOnly ? undefined : "Click to advance status"}
                      >
                        {c.status}
                      </button>
                    </td>
                    <td className="mono right">
                      {c.estCost > 0 ? `£${c.estCost.toFixed(2)}` : <span style={{ color: "var(--text-faint)" }}>—</span>}
                    </td>
                    <td className="mono right">
                      {c.estCost > 0 ? `£${(c.estCost * c.qty).toFixed(2)}` : <span style={{ color: "var(--text-faint)" }}>—</span>}
                    </td>
                    {!readOnly && (
                      <td className="right" style={{ display: "flex", gap: 2, justifyContent: "flex-end" }}>
                        <button
                          className="btn ghost icon-only row-actions"
                          title="Edit"
                          onClick={() => editingId === c._id ? setEditingId(null) : startEdit(c)}
                        >
                          <Icons.Edit size={12} />
                        </button>
                        <button
                          className="btn ghost icon-only row-actions"
                          title="Delete"
                          onClick={() => remove({ id: c._id })}
                        >
                          <Icons.Trash />
                        </button>
                      </td>
                    )}
                  </tr>
                  {editingId === c._id && !readOnly && (
                    <tr className="edit-row">
                      <td colSpan={9}>
                        <div className="inline-edit-form">
                          <input className="input" placeholder="Name" value={editForm.name} onChange={e => setEditForm(f => ({ ...f, name: e.target.value }))} />
                          <input className="input" placeholder="Model / MPN" value={editForm.model} onChange={e => setEditForm(f => ({ ...f, model: e.target.value }))} />
                          <input className="input" type="number" min="1" placeholder="Qty" value={editForm.qty} onChange={e => handleEditQty(e.target.value)} />
                          <input className="input" placeholder="Supplier" value={editForm.supplier} onChange={e => setEditForm(f => ({ ...f, supplier: e.target.value }))} />
                          <input className="input" type="number" step="0.01" min="0" placeholder="Cost/unit" value={editForm.estCost} onChange={e => handleEditEstCost(e.target.value)} />
                          <div style={{ position: "relative", width: "100%" }}>
                            <input
                              className="input"
                              type="number"
                              step="0.01"
                              min="0"
                              placeholder="Total (£)"
                              value={editForm.totalCost}
                              readOnly={editTotalIsAuto}
                              onChange={e => !editTotalIsAuto && setEditForm(f => ({ ...f, totalCost: e.target.value }))}
                              style={{ opacity: editTotalIsAuto ? 0.7 : 1 }}
                            />
                            {editTotalIsAuto && (
                              <span style={{ position: "absolute", right: 8, top: "50%", transform: "translateY(-50%)", fontSize: 10, color: "var(--text-faint)", pointerEvents: "none" }}>auto</span>
                            )}
                          </div>
                          <button className="btn primary sm" onClick={() => saveEdit(c._id)}>Save</button>
                          <button className="btn ghost sm" onClick={() => setEditingId(null)}>Cancel</button>
                        </div>
                      </td>
                    </tr>
                  )}
                </React.Fragment>
              ))}
              {filtered.length === 0 && (
                <tr>
                  <td colSpan={9} style={{ textAlign: "center", padding: "40px 0", color: "var(--text-muted)" }}>
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
              <span className="v">£{budgetCap.toFixed(2)}</span>
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

      {pdfViewing && (
        <div className="pdf-overlay" onClick={() => setPdfViewing(null)}>
          <div className="pdf-modal" onClick={e => e.stopPropagation()}>
            <div className="pdf-modal-header">
              <span style={{ fontFamily: "var(--font-mono)", fontSize: 11 }}>Datasheet</span>
              <button className="btn ghost icon-only sm" onClick={() => setPdfViewing(null)}>
                <Icons.X size={14} />
              </button>
            </div>
            <div className="pdf-modal-body">
              {pdfUrl ? (
                <iframe src={pdfUrl} title="Datasheet PDF" style={{ width: "100%", height: "100%", border: "none" }} />
              ) : (
                <div style={{ display: "flex", alignItems: "center", justifyContent: "center", height: "100%", color: "var(--text-muted)" }}>
                  Loading…
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
}
