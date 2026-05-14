'use client';

import React, { useState, useCallback, useMemo } from 'react';
import { useQuery, useMutation, useAction } from 'convex/react';
import { api } from '../../../convex/_generated/api';
import { Doc, Id } from '../../../convex/_generated/dataModel';
import * as Icons from '../Icons';

type DocType = "pdf" | "image" | "md" | "json" | "txt";

function inferType(name: string): DocType {
  const lower = name.toLowerCase();
  if (lower.endsWith(".pdf")) return "pdf";
  if (lower.endsWith(".md") || lower.endsWith(".markdown")) return "md";
  if (lower.endsWith(".json")) return "json";
  if (lower.endsWith(".txt")) return "txt";
  if (/\.(png|jpe?g|gif|webp|bmp)$/.test(lower)) return "image";
  return "txt";
}

function iconFor(t: DocType) {
  if (t === "pdf") return <Icons.Pdf />;
  return <Icons.File />;
}

function fmtSize(bytes?: number): string {
  if (!bytes) return "—";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} kB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

export default function Docs() {
  const docs = useQuery(api.documents.list, { limit: 200 });
  const generateUploadUrl = useMutation(api.documents.generateUploadUrl);
  const createDoc = useMutation(api.documents.create);
  const removeDoc = useMutation(api.documents.remove);
  const processDocument = useAction(api.ingest.processDocument);

  const [active, setActive] = useState<Id<"documents"> | null>(null);
  const [query, setQuery] = useState("");
  const [dragOver, setDragOver] = useState(false);
  const [uploadStatus, setUploadStatus] = useState<string>("");
  const [, setReindexingId] = useState<Id<"documents"> | null>(null);

  const list = useMemo(() => docs ?? [], [docs]);
  const filtered = useMemo(() => {
    if (!query) return list;
    const q = query.toLowerCase();
    return list.filter(d => d.name.toLowerCase().includes(q));
  }, [list, query]);

  const activeDoc = active ? list.find(d => d._id === active) : null;

  const handleFiles = useCallback(async (files: FileList | File[]) => {
    for (const file of Array.from(files)) {
      try {
        setUploadStatus(`Uploading ${file.name}…`);
        const url = await generateUploadUrl();
        const res = await fetch(url, {
          method: "POST",
          headers: { "Content-Type": file.type || "application/octet-stream" },
          body: file,
        });
        if (!res.ok) throw new Error(`upload failed: ${res.status}`);
        const { storageId } = (await res.json()) as { storageId: Id<"_storage"> };

        const documentId = await createDoc({
          name: file.name,
          type: inferType(file.name),
          storageId,
          size: file.size,
        });

        setUploadStatus(`Ingesting ${file.name}…`);
        await processDocument({ documentId });
        setUploadStatus(`✓ ${file.name} ready`);
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        setUploadStatus(`✗ ${file.name}: ${msg}`);
      }
    }
    setTimeout(() => setUploadStatus(""), 4000);
  }, [generateUploadUrl, createDoc, processDocument]);

  function onDrop(e: React.DragEvent) {
    e.preventDefault();
    setDragOver(false);
    if (e.dataTransfer.files.length > 0) {
      void handleFiles(e.dataTransfer.files);
    }
  }

  function onPickFile(e: React.ChangeEvent<HTMLInputElement>) {
    if (e.target.files && e.target.files.length > 0) {
      void handleFiles(e.target.files);
      e.target.value = "";
    }
  }

  return (
    <>
      <header className="screen-header">
        <div className="title-block">
          <div className="crumb">Workspace · documents/</div>
          <h1>
            Docs{" "}
            <span style={{ fontFamily: "var(--font-mono)", fontSize: 12, color: "var(--text-faint)", marginLeft: 8 }}>
              {list.length} files
            </span>
          </h1>
        </div>
        <div className="actions">
          {uploadStatus && (
            <span style={{ fontFamily: "var(--font-mono)", fontSize: 11, color: "var(--text-muted)" }}>
              {uploadStatus}
            </span>
          )}
          <label className="btn primary sm" style={{ cursor: "pointer" }}>
            <Icons.Plus /><span>Upload</span>
            <input
              type="file"
              multiple
              style={{ display: "none" }}
              onChange={onPickFile}
              accept=".pdf,.md,.markdown,.json,.txt,image/*"
            />
          </label>
        </div>
      </header>

      <div className="docs-grid">
        <aside className="docs-side">
          <div className="search">
            <Icons.Search />
            <input
              placeholder="Search docs…"
              value={query}
              onChange={e => setQuery(e.target.value)}
            />
          </div>
          <div className="docs-list">
            {!docs && (
              <div style={{ padding: 16, color: "var(--text-muted)", fontSize: 12 }}>Loading…</div>
            )}
            {docs && list.length === 0 && (
              <div style={{ padding: 16, color: "var(--text-muted)", fontSize: 12 }}>
                No documents ingested yet. Drag a file below.
              </div>
            )}
            {filtered.map(d => (
              <div
                key={d._id}
                className={"docs-item" + (active === d._id ? " active" : "")}
                onClick={() => setActive(d._id)}
              >
                {iconFor(d.type)}
                <span style={{ flex: 1, minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{d.name}</span>
                <span className="size">
                  {d.status === "ready" ? fmtSize(d.size) : <em style={{ color: "var(--text-faint)" }}>{d.status}</em>}
                </span>
              </div>
            ))}
          </div>
          <label
            className="docs-drop"
            style={{ cursor: "pointer", background: dragOver ? "var(--bg-elev)" : undefined }}
            onDragOver={e => { e.preventDefault(); setDragOver(true); }}
            onDragLeave={() => setDragOver(false)}
            onDrop={onDrop}
          >
            <input
              type="file"
              multiple
              style={{ display: "none" }}
              onChange={onPickFile}
              accept=".pdf,.md,.markdown,.json,.txt,image/*"
            />
            Drag files here<br />
            <span style={{ color: "var(--text-faint)" }}>
              .pdf · .md · .json · .txt · images
            </span>
          </label>
        </aside>

        <div className="docs-viewer">
          <div className="doc-content">
            {activeDoc ? (
            <ActiveDocView
              doc={activeDoc}
              onRemove={() => { void removeDoc({ documentId: activeDoc._id }); setActive(null); }}
              onReindex={async () => {
                setReindexingId(activeDoc._id);
                setUploadStatus(`Re-indexing ${activeDoc.name}…`);
                try {
                  await processDocument({ documentId: activeDoc._id });
                  setUploadStatus(`✓ ${activeDoc.name} re-indexed`);
                } catch {
                  setUploadStatus(`✗ Re-index failed`);
                } finally {
                  setReindexingId(null);
                  setTimeout(() => setUploadStatus(""), 3000);
                }
              }}
            />
          ) : (
              <div style={{ textAlign: "center", padding: 40, color: "var(--text-muted)" }}>
                {list.length === 0
                  ? "Drop a file in the sidebar to start ingesting."
                  : "Pick a document on the left."}
              </div>
            )}
          </div>
        </div>
      </div>
    </>
  );
}

function ActiveDocView({ doc, onRemove, onReindex }: { doc: Doc<"documents">; onRemove: () => void; onReindex: () => void }) {
  return (
    <>
      <h1>{doc.name}</h1>
      <div className="doc-meta">
        <span>{doc.type.toUpperCase()}</span>
        <span>{fmtSize(doc.size)}</span>
        <span>Uploaded {new Date(doc.uploadedAt).toISOString().slice(0, 16).replace("T", " ")}</span>
        <span style={{ marginLeft: "auto" }}>
          <span className={"status-chip " + (doc.status === "ready" ? "installed" : doc.status === "error" ? "ordered" : "planned")}>
            {doc.status}
          </span>
        </span>
      </div>

      <div style={{ marginTop: 14, padding: 14, border: "1px solid var(--line)", borderRadius: 6, background: "var(--bg-elev)" }}>
        {doc.status === "pending" && <p>Queued for processing…</p>}
        {doc.status === "processing" && <p>Parsing and embedding…</p>}
        {doc.status === "ready" && (
          <p>
            Ready. <strong>{doc.chunkCount ?? 0}</strong> chunk
            {doc.chunkCount === 1 ? "" : "s"} indexed for retrieval. The
            assistant will surface this content automatically in chat.
          </p>
        )}
        {doc.status === "error" && (
          <p style={{ color: "var(--text-fail, #c33)" }}>
            <strong>Ingestion failed.</strong> {doc.error ?? "Unknown error."}
          </p>
        )}
      </div>

      <div style={{ marginTop: 16, display: "flex", gap: 6 }}>
        <button className="btn sm" onClick={onReindex} title="Re-parse and re-embed this document" disabled={doc.status === "processing"}>
          <Icons.Branch size={13} /><span>Re-index</span>
        </button>
        <button className="btn sm" onClick={onRemove}>
          <Icons.Trash /><span>Remove from index</span>
        </button>
      </div>
    </>
  );
}
