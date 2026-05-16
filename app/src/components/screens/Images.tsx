'use client';

import React, { useState, useRef, useCallback, useEffect } from 'react';
import { useQuery, useMutation } from 'convex/react';
import { api } from '../../../convex/_generated/api';
import { Id } from '../../../convex/_generated/dataModel';
import * as Icons from '../Icons';
import { AppUser } from '../../lib/users';

const CATEGORIES = ["PCB", "Assembly", "Testing", "Mechanical", "General"];

function fmtDate(ts: number) {
  return new Date(ts).toLocaleDateString(undefined, { day: "numeric", month: "short", year: "numeric" });
}

function fmtSize(bytes?: number) {
  if (!bytes) return "";
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} kB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

function isVideo(doc: { mimeType?: string; filename?: string }) {
  if (doc.mimeType?.startsWith("video/")) return true;
  const ext = doc.filename?.split(".").pop()?.toLowerCase();
  return ext === "mp4" || ext === "mov" || ext === "webm" || ext === "mkv";
}

type ImageDoc = {
  _id: Id<"progressImages">;
  storageId: Id<"_storage">;
  url: string | null;
  caption?: string;
  category?: string;
  uploadedBy: string;
  uploadedAt: number;
  size?: number;
  filename?: string;
  mimeType?: string;
};

interface LightboxProps {
  images: ImageDoc[];
  index: number;
  onClose: () => void;
  onNavigate: (i: number) => void;
  onUpdateCaption: (id: Id<"progressImages">, caption: string) => void;
  onDelete: (id: Id<"progressImages">) => void;
  readOnly?: boolean;
}

function Lightbox({ images, index, onClose, onNavigate, onUpdateCaption, onDelete, readOnly }: LightboxProps) {
  const img = images[index];
  const [editingCaption, setEditingCaption] = useState(false);
  const [draft, setDraft] = useState(img?.caption ?? "");

  useEffect(() => {
    setEditingCaption(false);
    setDraft(img?.caption ?? "");
  }, [index, img?.caption]);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
      if (e.key === "ArrowLeft" && index > 0) onNavigate(index - 1);
      if (e.key === "ArrowRight" && index < images.length - 1) onNavigate(index + 1);
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [index, images.length, onClose, onNavigate]);

  if (!img) return null;

  function saveCaption() {
    onUpdateCaption(img._id, draft.trim());
    setEditingCaption(false);
  }

  return (
    <div
      className="img-lightbox"
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <button className="img-lightbox-close" onClick={onClose} title="Close (Esc)">
        <Icons.X size={16} />
      </button>

      <div className="img-lightbox-img-wrap">
        {index > 0 && (
          <button className="img-lightbox-nav prev" onClick={() => onNavigate(index - 1)} title="Previous (←)">
            <Icons.ChevronLeft size={18} />
          </button>
        )}
        {img.url && (isVideo(img)
          ? <video src={img.url} className="img-lightbox-img" controls autoPlay />
          : <img src={img.url} alt={img.caption ?? img.filename ?? ""} className="img-lightbox-img" />
        )}
        {index < images.length - 1 && (
          <button className="img-lightbox-nav next" onClick={() => onNavigate(index + 1)} title="Next (→)">
            <Icons.ChevronRight size={18} />
          </button>
        )}
      </div>

      <div className="img-lightbox-footer">
        {!readOnly && editingCaption ? (
          <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
            <input
              autoFocus
              className="img-lightbox-caption-edit"
              value={draft}
              onChange={e => setDraft(e.target.value)}
              onKeyDown={e => { if (e.key === "Enter") saveCaption(); if (e.key === "Escape") setEditingCaption(false); }}
              placeholder="Add a caption…"
            />
            <button className="btn primary sm" onClick={saveCaption}>Save</button>
          </div>
        ) : (
          <div
            className={"img-lightbox-caption" + (img.caption ? "" : " placeholder")}
            onClick={readOnly ? undefined : () => setEditingCaption(true)}
            title={readOnly ? undefined : "Click to edit caption"}
            style={{ cursor: readOnly ? "default" : "text" }}
          >
            {img.caption || (readOnly ? "" : "Click to add a caption…")}
          </div>
        )}

        <div className="img-lightbox-meta">
          {img.category && <span>{img.category}</span>}
          <span>{fmtDate(img.uploadedAt)}</span>
          <span>uploaded by {img.uploadedBy}</span>
          {img.size && <span>{fmtSize(img.size)}</span>}
          {!readOnly && (
            <span style={{ marginLeft: "auto" }}>
              <button
                style={{ background: "none", border: "none", color: "rgba(255,255,255,0.4)", cursor: "pointer", padding: "2px 4px" }}
                title="Delete image"
                onClick={() => { onDelete(img._id); onClose(); }}
              >
                <Icons.Trash size={12} />
              </button>
            </span>
          )}
        </div>
      </div>

      <div style={{ position: "absolute", bottom: 16, left: "50%", transform: "translateX(-50%)", display: "flex", gap: 5 }}>
        {images.map((_, i) => (
          <div
            key={i}
            onClick={() => onNavigate(i)}
            style={{
              width: i === index ? 18 : 6, height: 6, borderRadius: 3,
              background: i === index ? "rgba(255,255,255,0.8)" : "rgba(255,255,255,0.25)",
              cursor: "pointer", transition: "width 0.2s, background 0.2s",
            }}
          />
        ))}
      </div>
    </div>
  );
}

interface ImagesProps {
  currentUser: AppUser;
  searchBar?: React.ReactNode;
}

export default function Images({ currentUser, searchBar }: ImagesProps) {
  const images = useQuery(api.progressImages.listWithUrls, {});
  const generateUploadUrl = useMutation(api.progressImages.generateUploadUrl);
  const createImage = useMutation(api.progressImages.create);
  const removeImage = useMutation(api.progressImages.remove);
  const updateImage = useMutation(api.progressImages.update);

  const [filter, setFilter] = useState("all");
  const [dateRange, setDateRange] = useState<7 | 30 | 0>(0); // 0 = all time
  const [dragOver, setDragOver] = useState(false);
  const [uploadStatus, setUploadStatus] = useState("");
  const [lightboxIndex, setLightboxIndex] = useState<number | null>(null);
  const [editingId, setEditingId] = useState<Id<"progressImages"> | null>(null);
  const [captionDraft, setCaptionDraft] = useState("");

  const fileInputRef = useRef<HTMLInputElement>(null);

  const filtered = (images ?? []).filter(img => {
    if (filter !== "all" && (img.category ?? "General") !== filter) return false;
    if (dateRange > 0 && img.uploadedAt < Date.now() - dateRange * 86_400_000) return false;
    return true;
  });

  const handleFiles = useCallback(async (files: FileList | File[]) => {
    const arr = Array.from(files).filter(f =>
      f.type.startsWith("image/") || f.type.startsWith("video/")
    );
    if (!arr.length) return;
    for (const file of arr) {
      try {
        setUploadStatus(`Uploading ${file.name}…`);
        const url = await generateUploadUrl();
        const res = await fetch(url, {
          method: "POST",
          headers: { "Content-Type": file.type || "application/octet-stream" },
          body: file,
        });
        if (!res.ok) throw new Error(`Upload failed: ${res.status}`);
        const { storageId } = (await res.json()) as { storageId: Id<"_storage"> };
        await createImage({
          storageId,
          caption: "",
          category: "General",
          uploadedBy: currentUser.name,
          size: file.size,
          filename: file.name,
          mimeType: file.type,
        });
        setUploadStatus(`✓ ${file.name}`);
      } catch (err) {
        setUploadStatus(`✗ ${file.name}: ${err instanceof Error ? err.message : String(err)}`);
      }
    }
    setTimeout(() => setUploadStatus(""), 3000);
  }, [generateUploadUrl, createImage, currentUser.name]);

  function onDrop(e: React.DragEvent) {
    e.preventDefault();
    setDragOver(false);
    handleFiles(e.dataTransfer.files);
  }

  async function saveCaption(id: Id<"progressImages">, caption: string) {
    await updateImage({ id, caption });
    setEditingId(null);
  }

  async function changeCategory(id: Id<"progressImages">, category: string) {
    await updateImage({ id, category });
  }

  const lightboxImages = filter === "all" ? (images ?? []) : filtered;
  const lightboxImg = lightboxIndex !== null ? lightboxImages[lightboxIndex] : null;

  return (
    <div className="img-screen">
      <header className="screen-header">
        <div className="title-block">
          <div className="crumb">Workspace · Images</div>
          <h1>
            Images{" "}
            {images && (
              <span style={{ fontFamily: "var(--font-mono)", fontSize: 12, color: "var(--text-faint)", marginLeft: 8 }}>
                {images.length} photos
              </span>
            )}
          </h1>
        </div>
        <div className="actions">
          {searchBar}
          {!currentUser.isGuest && (
            <button className="btn primary sm" onClick={() => fileInputRef.current?.click()}>
              <Icons.ArrowUp />
              <span>Upload</span>
            </button>
          )}
        </div>
      </header>

      {!currentUser.isGuest && (
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*,video/mp4,video/mov,video/webm,video/mkv"
          multiple
          style={{ display: "none" }}
          onChange={e => e.target.files && handleFiles(e.target.files)}
        />
      )}

      {/* Category + date-range filters */}
      <div className="img-filter-bar">
        <button className={"chip" + (filter === "all" ? " active" : "")} onClick={() => setFilter("all")}>
          All <span style={{ opacity: 0.5, marginLeft: 4 }}>{(images ?? []).length}</span>
        </button>
        {CATEGORIES.map(cat => {
          const n = (images ?? []).filter(i => (i.category ?? "General") === cat).length;
          if (n === 0) return null;
          return (
            <button key={cat} className={"chip" + (filter === cat ? " active" : "")} onClick={() => setFilter(cat)}>
              {cat} <span style={{ opacity: 0.5, marginLeft: 4 }}>{n}</span>
            </button>
          );
        })}
        <div style={{ width: 1, background: 'var(--line)', margin: '0 4px', alignSelf: 'stretch' }} />
        {([7, 30, 0] as const).map(d => (
          <button key={d} className={"chip" + (dateRange === d ? " active" : "")} onClick={() => setDateRange(d)}>
            {d === 0 ? 'All time' : d === 7 ? 'Last 7d' : 'Last 30d'}
          </button>
        ))}
      </div>

      {uploadStatus && <div className="img-upload-status">{uploadStatus}</div>}

      {/* Gallery or empty state */}
      {images === undefined ? (
        <div className="img-gallery-wrap">
          <div style={{ color: "var(--text-faint)", padding: 40 }}>Loading…</div>
        </div>
      ) : images.length === 0 ? (
        currentUser.isGuest ? (
          <div className="img-gallery-wrap">
            <div style={{ color: "var(--text-faint)", padding: 40, textAlign: "center", fontFamily: "var(--font-mono)", fontSize: 12 }}>No photos yet.</div>
          </div>
        ) : (
          <div
            className={"img-dropzone" + (dragOver ? " drag-over" : "")}
            style={{ flex: 1, margin: "24px 32px", justifyContent: "center" }}
            onClick={() => fileInputRef.current?.click()}
            onDragOver={e => { e.preventDefault(); setDragOver(true); }}
            onDragLeave={() => setDragOver(false)}
            onDrop={onDrop}
          >
            <div className="img-dropzone-icon"><Icons.Image size={48} /></div>
            <div className="img-dropzone-label">Drop images here or click to upload</div>
            <div className="img-dropzone-sub">PNG · JPG · WEBP · GIF · MP4 · MOV — document your build progress</div>
          </div>
        )
      ) : (
        <>
          {/* Compact drop strip — hidden for guests */}
          {!currentUser.isGuest && (
            <div
              className={"img-dropzone" + (dragOver ? " drag-over" : "")}
              style={{ padding: "12px 20px", flexDirection: "row", gap: 10, margin: "16px 32px 0" }}
              onClick={() => fileInputRef.current?.click()}
              onDragOver={e => { e.preventDefault(); setDragOver(true); }}
              onDragLeave={() => setDragOver(false)}
              onDrop={onDrop}
            >
              <div className="img-dropzone-icon"><Icons.ArrowUp size={16} /></div>
              <span className="img-dropzone-label" style={{ fontSize: 12 }}>Drop more images or click to upload</span>
            </div>
          )}

          <div className="img-gallery-wrap">
            {filtered.length === 0 ? (
              <div style={{ color: "var(--text-faint)", padding: 40, textAlign: "center" }}>
                No images in this category.
              </div>
            ) : (
              <div className="img-gallery">
                {filtered.map((img, i) => (
                  <div key={img._id} className="img-card">
                    <div className="img-card-thumb" onClick={() => setLightboxIndex(i)}>
                      {img.url
                        ? isVideo(img)
                          ? (
                            <video
                              src={img.url}
                              muted
                              loop
                              playsInline
                              onMouseEnter={e => (e.currentTarget as HTMLVideoElement).play()}
                              onMouseLeave={e => { const v = e.currentTarget as HTMLVideoElement; v.pause(); v.currentTime = 0; }}
                              style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }}
                            />
                          )
                          : <img src={img.url} alt={img.caption ?? img.filename ?? ""} loading="lazy" />
                        : <div style={{ width: "100%", height: "100%", background: "var(--bg-sunk)", display: "flex", alignItems: "center", justifyContent: "center" }}><Icons.Image size={32} /></div>
                      }
                      {isVideo(img) && (
                        <div style={{ position: "absolute", top: 8, left: 8, background: "rgba(0,0,0,0.55)", borderRadius: 4, padding: "2px 6px", fontSize: 9, fontFamily: "var(--font-mono)", color: "#fff", letterSpacing: "0.06em", textTransform: "uppercase" }}>
                          VIDEO
                        </div>
                      )}
                      <div className="img-card-overlay">
                        <span className="img-card-overlay-caption">{img.caption || ""}</span>
                        {!currentUser.isGuest && (
                          <button
                            className="img-card-delete"
                            title="Delete"
                            onClick={e => { e.stopPropagation(); removeImage({ id: img._id }); }}
                          >
                            <Icons.Trash size={11} />
                          </button>
                        )}
                      </div>
                    </div>

                    <div className="img-card-info">
                      {!currentUser.isGuest && editingId === img._id ? (
                        <input
                          autoFocus
                          className="img-caption-input"
                          value={captionDraft}
                          onChange={e => setCaptionDraft(e.target.value)}
                          onKeyDown={e => {
                            if (e.key === "Enter") saveCaption(img._id, captionDraft);
                            if (e.key === "Escape") setEditingId(null);
                          }}
                          onBlur={() => saveCaption(img._id, captionDraft)}
                          placeholder="Add caption…"
                        />
                      ) : (
                        <div
                          className={"img-card-caption" + (img.caption ? "" : " placeholder")}
                          onClick={currentUser.isGuest ? undefined : () => { setEditingId(img._id); setCaptionDraft(img.caption ?? ""); }}
                          title={currentUser.isGuest ? undefined : "Click to edit caption"}
                          style={{ cursor: currentUser.isGuest ? "default" : "text" }}
                        >
                          {img.caption || (currentUser.isGuest ? "" : "Add caption…")}
                        </div>
                      )}

                      <div className="img-card-meta">
                        <span className="img-card-date">{fmtDate(img.uploadedAt)}</span>
                        {currentUser.isGuest ? (
                          <span style={{ fontSize: 9, fontFamily: "var(--font-mono)", color: "var(--accent-fg)", textTransform: "uppercase", letterSpacing: "0.06em" }}>
                            {img.category ?? "General"}
                          </span>
                        ) : (
                          <select
                            value={img.category ?? "General"}
                            onChange={e => changeCategory(img._id, e.target.value)}
                            onClick={e => e.stopPropagation()}
                            style={{ background: "none", border: "none", fontSize: 9, fontFamily: "var(--font-mono)", color: "var(--accent-fg)", cursor: "pointer", textTransform: "uppercase", letterSpacing: "0.06em", padding: 0 }}
                          >
                            {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
                          </select>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </>
      )}

      {lightboxIndex !== null && lightboxImg && (
        <Lightbox
          images={lightboxImages as ImageDoc[]}
          index={lightboxIndex}
          onClose={() => setLightboxIndex(null)}
          onNavigate={setLightboxIndex}
          onUpdateCaption={(id, caption) => updateImage({ id, caption })}
          onDelete={(id) => removeImage({ id })}
          readOnly={currentUser.isGuest}
        />
      )}
    </div>
  );
}
