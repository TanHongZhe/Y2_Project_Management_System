'use client';

import React, { useState, useRef, useMemo } from 'react';
import { useQuery, useMutation } from 'convex/react';
import { api } from '../../../convex/_generated/api';
import { Id } from '../../../convex/_generated/dataModel';
import { renderMarkdown } from '@/lib/markdown';
import * as Icons from '../Icons';
import MentionInput from '../MentionInput';
import { extractMentionedUserIds } from '../../lib/mentions';

export default function Memory({ readOnly, searchBar, currentUserId }: { readOnly?: boolean; searchBar?: React.ReactNode; currentUserId?: string }) {
  const notes = useQuery(api.memoryNotes.list, {});
  const upsert = useMutation(api.memoryNotes.upsert);
  const remove = useMutation(api.memoryNotes.remove);
  const notifyMention = useMutation(api.notifications.notifyMention);

  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<Id<"memoryNotes"> | null>(null);
  const [draft, setDraft] = useState("");
  const [newSection, setNewSection] = useState("");
  const [showNew, setShowNew] = useState(false);
  const refs = useRef<Record<string, HTMLElement | null>>({});
  const scrollRef = useRef<HTMLDivElement>(null);

  const sections = useMemo(() => notes ?? [], [notes]);
  const activeId = selectedId ?? sections[0]?._id ?? null;

  function jump(id: string) {
    setSelectedId(id);
    const el = refs.current[id];
    if (el && scrollRef.current) {
      scrollRef.current.scrollTo({ top: el.offsetTop - 20, behavior: "smooth" });
    }
  }

  function beginEdit(id: Id<"memoryNotes">, content: string) {
    setEditingId(id);
    setDraft(content);
  }

  async function commitEdit(section: string) {
    if (!editingId) return;
    const savedId = editingId;
    await upsert({ section, content: draft, author: "you" });
    setEditingId(null);
    // Fire @mentions after the save so the notification's linkId points to a
    // persisted doc. Server is idempotent per (linkId, user) so re-edits stay safe.
    const mentioned = extractMentionedUserIds(draft, currentUserId);
    for (const userId of mentioned) {
      void notifyMention({
        userId,
        fromUserId: currentUserId ?? "system",
        linkRoute: "memory",
        linkId: savedId as string,
        contextLabel: `Project Memory — ${section}`,
      });
    }
  }

  async function createSection() {
    const title = newSection.trim();
    if (!title) return;
    await upsert({ section: title, content: "", author: "you" });
    setNewSection("");
    setShowNew(false);
  }

  async function deleteSection(id: Id<"memoryNotes">) {
    await remove({ id });
    if (editingId === id) setEditingId(null);
  }

  if (!notes) {
    return (
      <>
        <header className="screen-header">
          <div className="title-block">
            <div className="crumb">Workspace · project_memory</div>
            <h1>Project Memory</h1>
          </div>
        </header>
        <div className="body"><div style={{ padding: 40, color: "var(--text-muted)" }}>Loading…</div></div>
      </>
    );
  }

  const totalEntries = sections.length;
  const lastUpdate = sections.reduce((max, s) => Math.max(max, s.updatedAt), 0);
  const lastUpdateStr = lastUpdate ? new Date(lastUpdate).toISOString().slice(0, 16).replace("T", " ") : "—";
  const bytes = sections.reduce((s, n) => s + n.content.length, 0);

  return (
    <>
      <header className="screen-header">
        <div className="title-block">
          <div className="crumb">Workspace · project_memory</div>
          <h1>Project Memory</h1>
        </div>
        <div className="actions">
          {searchBar}
          <button className="btn ghost sm"><Icons.Eye /><span>Raw markdown</span></button>
          {!readOnly && (
            <button className="btn primary sm" onClick={() => setShowNew(s => !s)}>
              <Icons.Plus /><span>New section</span>
            </button>
          )}
        </div>
      </header>

      <div className="two-col">
        <div className="toc">
          <div style={{ padding: "0 10px 10px", fontFamily: "var(--font-mono)", fontSize: 10, letterSpacing: "0.08em", textTransform: "uppercase", color: "var(--text-faint)" }}>
            Sections · {totalEntries}
          </div>
          {sections.map(s => (
            <div
              key={s._id}
              className={"toc-item" + (activeId === s._id ? " active" : "")}
              onClick={() => jump(s._id)}
            >
              <span className="dot" />
              <span>{s.section}</span>
              <span className="num">{s.author === "ai" ? "ai" : ""}</span>
            </div>
          ))}
          {sections.length === 0 && (
            <div style={{ padding: 16, color: "var(--text-muted)", fontSize: 12 }}>
              No sections yet. Click <em>New section</em> above.
            </div>
          )}
        </div>

        <div className="memory-doc" ref={scrollRef}>
          <div style={{ fontFamily: "var(--font-mono)", fontSize: 11, color: "var(--text-faint)", marginBottom: 4 }}>
            project_memory
          </div>
          <h1 style={{ fontSize: 22, fontWeight: 600, margin: "0 0 4px", letterSpacing: "-0.01em" }}>
            Solar Bus Demonstrator — Living Memory
          </h1>
          <div style={{ fontFamily: "var(--font-mono)", fontSize: 11, color: "var(--text-muted)" }}>
            last updated {lastUpdateStr} · {(bytes / 1024).toFixed(1)} kB · {totalEntries} sections
          </div>

          {showNew && !readOnly && (
            <div className="memory-section editing" style={{ marginTop: 18 }}>
              <header>
                <h2>## New section</h2>
                <input
                  autoFocus
                  className="input"
                  placeholder="Section title"
                  value={newSection}
                  onChange={e => setNewSection(e.target.value)}
                  style={{ flex: 1, marginLeft: 12 }}
                />
                <button className="btn primary sm" onClick={createSection}>
                  <Icons.Check /><span>Create</span>
                </button>
                <button className="btn ghost sm" onClick={() => setShowNew(false)}>
                  <span>Cancel</span>
                </button>
              </header>
            </div>
          )}

          {sections.length === 0 && !showNew && (
            <div style={{ marginTop: 40, padding: 32, border: "1px dashed var(--line)", borderRadius: 8, textAlign: "center", color: "var(--text-muted)" }}>
              No memory sections yet. The assistant adds these via <code>update_memory</code>,
              or click <em>New section</em> to add your own.
            </div>
          )}

          {sections.map(s => (
            <section
              key={s._id}
              className={"memory-section" + (editingId === s._id ? " editing" : "")}
              ref={(el: HTMLElement | null) => { refs.current[s._id] = el; }}
              onMouseEnter={() => setSelectedId(s._id)}
            >
              <header>
                <h2>## {s.section}</h2>
                <span className="author">{s.author}</span>
                <span className="updated">updated {new Date(s.updatedAt).toISOString().slice(0, 10)}</span>
                {!readOnly && (editingId === s._id ? (
                  <>
                    <button className="btn primary sm edit-btn" onClick={() => commitEdit(s.section)}>
                      <Icons.Check /><span>Save</span>
                    </button>
                    <button className="btn ghost sm" onClick={() => setEditingId(null)}>
                      <span>Cancel</span>
                    </button>
                  </>
                ) : (
                  <>
                    <button className="btn ghost sm edit-btn" onClick={() => beginEdit(s._id, s.content)}>
                      <Icons.Edit /><span>Edit</span>
                    </button>
                    <button className="btn ghost sm" onClick={() => deleteSection(s._id)}>
                      <Icons.Trash /><span>Delete</span>
                    </button>
                  </>
                ))}
              </header>
              <div className="content">
                {editingId === s._id && !readOnly ? (
                  <MentionInput
                    autoFocus
                    value={draft}
                    onChange={setDraft}
                    currentUserId={currentUserId}
                    placeholder="Notes — use @hongzhe to mention a teammate"
                    style={{
                      width: "100%",
                      minHeight: 180,
                      background: "var(--bg-elev)",
                      border: "1px solid var(--line)",
                      borderRadius: 4,
                      padding: 10,
                      fontFamily: "var(--font-mono)",
                      fontSize: 12.5,
                      color: "var(--text)",
                      resize: "vertical",
                    }}
                  />
                ) : s.content.trim() ? (
                  renderMarkdown(s.content)
                ) : (
                  <p style={{ color: "var(--text-faint)" }}>Empty — click <em>Edit</em> to write.</p>
                )}
              </div>
            </section>
          ))}
        </div>
      </div>
    </>
  );
}
