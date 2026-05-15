'use client';

import React, { useState, useEffect, useRef } from 'react';
import { useQuery, useMutation } from 'convex/react';
import { useEditor, EditorContent } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import { Table } from '@tiptap/extension-table';
import { TableRow } from '@tiptap/extension-table-row';
import { TableHeader } from '@tiptap/extension-table-header';
import { TableCell } from '@tiptap/extension-table-cell';
import { Markdown } from 'tiptap-markdown';
import { api } from '../../../convex/_generated/api';
import { Id } from '../../../convex/_generated/dataModel';
import { USERS } from '../../lib/users';
import * as Icons from '../Icons';

interface MeetingsProps {
  currentUser: { id: string; name: string };
  readOnly?: boolean;
  searchBar?: React.ReactNode;
  selectedMeetingId?: string;
  onMeetingConsumed?: () => void;
}

interface MeetingEditorHandle {
  appendTranscript: (text: string) => void;
}

function fmtDate(ts: number) {
  return new Date(ts).toLocaleDateString("en-GB", {
    day: "numeric", month: "short", year: "numeric",
  });
}

function toInputDate(ts: number) {
  return new Date(ts).toISOString().slice(0, 10);
}

function fmtTime(secs: number) {
  return `${Math.floor(secs / 60).toString().padStart(2, '0')}:${(secs % 60).toString().padStart(2, '0')}`;
}

function getBestMimeType(): string {
  if (typeof MediaRecorder === 'undefined') return '';
  const types = [
    'audio/webm;codecs=opus',
    'audio/webm',
    'audio/ogg;codecs=opus',
    'audio/mp4',
  ];
  return types.find((t) => MediaRecorder.isTypeSupported(t)) ?? '';
}

export default function Meetings({ currentUser, readOnly, searchBar, selectedMeetingId, onMeetingConsumed }: MeetingsProps) {
  const meetings = useQuery(api.meetings.list, {});
  const memoryNotes = useQuery(api.memoryNotes.list, {});
  const create = useMutation(api.meetings.create);
  const update = useMutation(api.meetings.update);
  const remove = useMutation(api.meetings.remove);
  const upsertMemory = useMutation(api.memoryNotes.upsert);

  const [selectedId, setSelectedId] = useState<Id<"meetingNotes"> | null>(null);
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [attendees, setAttendees] = useState<string[]>([]);
  const [date, setDate] = useState(Date.now());
  const [syncing, setSyncing] = useState(false);
  const [syncMsg, setSyncMsg] = useState<{ text: string; ok: boolean } | null>(null);
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Recording
  const editorRef = useRef<MeetingEditorHandle | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const recordTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const [recording, setRecording] = useState(false);
  const [recordingTime, setRecordingTime] = useState(0);
  const [transcribing, setTranscribing] = useState(false);
  const [polishing, setPolishing] = useState(false);
  const [transcribeError, setTranscribeError] = useState<string | null>(null);

  const canRecord = typeof window !== 'undefined' && typeof MediaRecorder !== 'undefined';

  const selectedMeeting = meetings?.find((m) => m._id === selectedId);

  useEffect(() => {
    if (selectedMeetingId) {
      setSelectedId(selectedMeetingId as Id<"meetingNotes">);
      onMeetingConsumed?.();
    }
  }, [selectedMeetingId, onMeetingConsumed]);

  useEffect(() => {
    if (selectedMeeting) {
      setTitle(selectedMeeting.title);
      setContent(selectedMeeting.content);
      setAttendees(selectedMeeting.attendees);
      setDate(selectedMeeting.date);
      setSyncMsg(null);
      setTranscribeError(null);
    }
  }, [selectedId]);

  // Stop recording and release mic on unmount
  useEffect(() => {
    return () => {
      if (recordTimerRef.current) clearInterval(recordTimerRef.current);
      if (mediaRecorderRef.current) {
        mediaRecorderRef.current.onstop = null;
        try { mediaRecorderRef.current.stop(); } catch { /* already stopped */ }
        mediaRecorderRef.current.stream?.getTracks().forEach((t) => t.stop());
      }
    };
  }, []);

  function scheduleSave(patch: Partial<{ title: string; content: string; attendees: string[]; date: number }>) {
    if (!selectedId || readOnly) return;
    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(() => {
      update({ id: selectedId!, ...patch });
    }, 800);
  }

  async function handleCreate() {
    const id = await create({
      title: `Meeting ${fmtDate(Date.now())}`,
      date: Date.now(),
      attendees: [currentUser.id],
      content: "",
      createdBy: currentUser.id,
    });
    setSelectedId(id as Id<"meetingNotes">);
  }

  function toggleAttendee(userId: string) {
    if (readOnly) return;
    const next = attendees.includes(userId)
      ? attendees.filter((id) => id !== userId)
      : [...attendees, userId];
    setAttendees(next);
    if (selectedId) update({ id: selectedId, attendees: next });
  }

  async function handleSyncToMemory() {
    if (!selectedMeeting || !memoryNotes || !content.trim()) return;
    setSyncing(true);
    setSyncMsg(null);
    try {
      const res = await fetch("/api/merge-memory", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          meetingTitle: title,
          meetingContent: content,
          existingMemory: memoryNotes.map((n) => ({ section: n.section, content: n.content })),
        }),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = (await res.json()) as { updates: Array<{ section: string; content: string }> };
      for (const u of data.updates) {
        await upsertMemory({ section: u.section, content: u.content, author: "ai" });
      }
      setSyncMsg({
        text: data.updates.length > 0
          ? `Synced ${data.updates.length} section${data.updates.length !== 1 ? "s" : ""} to Project Memory`
          : "No memory updates needed",
        ok: true,
      });
    } catch (e) {
      setSyncMsg({ text: "Sync failed — please try again", ok: false });
      console.error("[merge-memory]", e);
    } finally {
      setSyncing(false);
    }
  }

  async function handleDelete() {
    if (!selectedId) return;
    await remove({ id: selectedId });
    setSelectedId(null);
  }

  async function startRecording() {
    setTranscribeError(null);
    const mimeType = getBestMimeType();
    if (!mimeType) {
      setTranscribeError("Recording not supported in this browser");
      return;
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      chunksRef.current = [];
      const mr = new MediaRecorder(stream, { mimeType });
      mr.ondataavailable = (e) => { if (e.data.size > 0) chunksRef.current.push(e.data); };
      mr.onstop = handleRecordingStop;
      mediaRecorderRef.current = mr;
      mr.start(500);
      setRecording(true);
      setRecordingTime(0);
      recordTimerRef.current = setInterval(() => setRecordingTime((t) => t + 1), 1000);
    } catch {
      setTranscribeError("Microphone access denied");
    }
  }

  function stopRecording() {
    if (recordTimerRef.current) clearInterval(recordTimerRef.current);
    recordTimerRef.current = null;
    const mr = mediaRecorderRef.current;
    if (mr) {
      mr.stop();
      mr.stream.getTracks().forEach((t) => t.stop());
    }
    mediaRecorderRef.current = null;
    setRecording(false);
  }

  async function handleRecordingStop() {
    if (chunksRef.current.length === 0) return;
    const mimeType = chunksRef.current[0]?.type || 'audio/webm';
    const blob = new Blob(chunksRef.current, { type: mimeType });
    chunksRef.current = [];

    setTranscribing(true);
    setTranscribeError(null);
    try {
      const ext = mimeType.includes('ogg') ? 'ogg' : mimeType.includes('mp4') ? 'mp4' : 'webm';
      const fd = new FormData();
      fd.append("audio", blob, `recording.${ext}`);
      const res = await fetch("/api/transcribe", { method: "POST", body: fd });
      if (!res.ok) {
        const err = (await res.json().catch(() => ({ error: `HTTP ${res.status}` }))) as { error: string };
        throw new Error(err.error);
      }
      const data = (await res.json()) as { transcript: string };
      const raw = data.transcript?.trim();
      if (!raw) return;

      // Polish the raw transcript before inserting into notes
      setTranscribing(false);
      setPolishing(true);
      let finalText = raw;
      try {
        const attendeeNames = attendees
          .map((id) => USERS.find((u) => u.id === id)?.name)
          .filter(Boolean) as string[];
        const projectContext = memoryNotes
          ?.slice(0, 8)
          .map((n) => `[${n.section}]\n${n.content}`)
          .join("\n\n") ?? "";
        const polishRes = await fetch("/api/polish-transcript", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ transcript: raw, attendees: attendeeNames, projectContext }),
        });
        if (polishRes.ok) {
          const pd = (await polishRes.json()) as { polished: string };
          if (pd.polished?.trim()) finalText = pd.polished.trim();
        }
      } catch (e) {
        console.warn("[polish-transcript] failed, using raw transcript", e);
      }
      editorRef.current?.appendTranscript(finalText);
    } catch (e) {
      console.error("[transcribe]", e);
      setTranscribeError("Transcription failed — please try again");
    } finally {
      setTranscribing(false);
      setPolishing(false);
    }
  }

  return (
    <>
      <header className="screen-header">
        <div className="title-block">
          <div className="crumb">Workspace · meetings</div>
          <h1>Meeting Notes</h1>
        </div>
        <div className="actions">
          {searchBar}
          {!readOnly && canRecord && (
            recording ? (
              <>
                <span className="record-dot" />
                <span className="record-timer">{fmtTime(recordingTime)}</span>
                <button className="btn sm" style={{ color: "var(--danger)" }} onClick={stopRecording}>
                  <Icons.StopCircle size={13} /><span>Stop</span>
                </button>
              </>
            ) : transcribing ? (
              <span className="record-timer">Transcribing…</span>
            ) : polishing ? (
              <span className="record-timer">Polishing…</span>
            ) : (
              <button
                className="btn sm"
                disabled={!selectedId}
                onClick={startRecording}
                title={!selectedId ? "Select a meeting first" : "Record meeting audio"}
              >
                <Icons.Mic size={13} /><span>Record</span>
              </button>
            )
          )}
          {!readOnly && (
            <button className="btn primary sm" onClick={handleCreate}>
              <Icons.Plus size={13} /><span>New meeting</span>
            </button>
          )}
        </div>
      </header>

      <div className="body meetings-body">
        <div className="meetings-list">
          {!meetings && <div className="meetings-loading">Loading…</div>}
          {meetings?.length === 0 && (
            <div className="meetings-empty-state">
              <p>No meetings yet.</p>
              {!readOnly && (
                <button className="btn primary sm" onClick={handleCreate}>
                  Create first meeting
                </button>
              )}
            </div>
          )}
          {meetings?.map((m) => (
            <div
              key={m._id}
              className={"meeting-list-item" + (selectedId === m._id ? " active" : "")}
              onClick={() => setSelectedId(m._id)}
            >
              <div className="mli-title">{m.title}</div>
              <div className="mli-date">{fmtDate(m.date)}</div>
            </div>
          ))}
        </div>

        <div className="meetings-editor">
          {!selectedId && (
            <div className="meetings-placeholder">
              <Icons.Chat size={28} />
              <p>Select a meeting or create a new one</p>
            </div>
          )}

          {selectedId && selectedMeeting && (
            <div className="meeting-edit-pane">
              <div className="meeting-meta-row">
                <input
                  className="meeting-title-field"
                  value={title}
                  disabled={readOnly}
                  placeholder="Meeting title"
                  onChange={(e) => { setTitle(e.target.value); scheduleSave({ title: e.target.value }); }}
                />
                <input
                  type="date"
                  className="meeting-date-field"
                  value={toInputDate(date)}
                  disabled={readOnly}
                  onChange={(e) => {
                    const ts = new Date(e.target.value).getTime();
                    if (!isNaN(ts)) { setDate(ts); scheduleSave({ date: ts }); }
                  }}
                />
              </div>

              <div className="meeting-attendees-row">
                <span className="meeting-attendees-label">Attendees</span>
                <div className="meeting-attendees-chips">
                  {USERS.filter((u) => !u.isGuest).map((u) => (
                    <button
                      key={u.id}
                      className={"attendee-chip" + (attendees.includes(u.id) ? " active" : "")}
                      style={attendees.includes(u.id) ? { background: u.color, color: "#fff", borderColor: u.color } : undefined}
                      onClick={() => toggleAttendee(u.id)}
                      title={u.name}
                    >
                      {u.initials}
                    </button>
                  ))}
                </div>
              </div>

              <MeetingEditor
                ref={editorRef}
                key={selectedId}
                initialContent={selectedMeeting.content}
                readOnly={readOnly}
                onChange={(md) => {
                  setContent(md);
                  scheduleSave({ content: md });
                }}
              />

              <div className="meeting-footer-row">
                <div className="meeting-footer-left">
                  {!readOnly && (
                    <>
                      <button
                        className="btn primary sm"
                        disabled={syncing || !content.trim()}
                        onClick={handleSyncToMemory}
                      >
                        {syncing ? "Syncing…" : "Send to Project Memory"}
                      </button>
                      <button className="btn sm" style={{ color: "var(--danger)" }} onClick={handleDelete}>
                        Delete
                      </button>
                    </>
                  )}
                </div>
                <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
                  {transcribeError && (
                    <span className="meeting-sync-msg error">{transcribeError}</span>
                  )}
                  {syncMsg && (
                    <span className={"meeting-sync-msg" + (syncMsg.ok ? "" : " error")}>
                      {syncMsg.text}
                    </span>
                  )}
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </>
  );
}

const MeetingEditor = React.forwardRef<MeetingEditorHandle, {
  initialContent: string;
  readOnly?: boolean;
  onChange: (md: string) => void;
}>(function MeetingEditor({ initialContent, readOnly, onChange }, ref) {
  const editor = useEditor({
    extensions: [
      StarterKit,
      Table.configure({ resizable: false }),
      TableRow,
      TableHeader,
      TableCell,
      Markdown.configure({ html: false, transformPastedText: true }),
    ],
    content: initialContent,
    editable: !readOnly,
    onUpdate({ editor }) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const md = (editor.storage as unknown as { markdown: { getMarkdown: () => string } }).markdown.getMarkdown();
      onChange(md);
    },
  });

  React.useImperativeHandle(ref, () => ({
    appendTranscript: (text: string) => {
      if (!editor) return;
      const end = editor.state.doc.content.size;
      editor.chain()
        .focus()
        .insertContentAt(end, [
          { type: "horizontalRule" },
          { type: "heading", attrs: { level: 2 }, content: [{ type: "text", text: "Recording Transcript" }] },
          { type: "paragraph", content: [{ type: "text", text: text }] },
        ])
        .run();
    },
  }), [editor]);

  function cmd(fn: () => void) {
    return (e: React.MouseEvent) => { e.preventDefault(); fn(); };
  }

  return (
    <div className="meeting-editor-wrap">
      {!readOnly && editor && (
        <div className="meeting-toolbar">
          <button
            className={"mtb-btn" + (editor.isActive("bold") ? " active" : "")}
            title="Bold"
            onMouseDown={cmd(() => editor.chain().focus().toggleBold().run())}
          ><Icons.Bold size={13} /></button>

          <button
            className={"mtb-btn" + (editor.isActive("italic") ? " active" : "")}
            title="Italic"
            onMouseDown={cmd(() => editor.chain().focus().toggleItalic().run())}
          ><Icons.Italic size={13} /></button>

          <div className="mtb-sep" />

          <button
            className={"mtb-btn" + (editor.isActive("heading", { level: 1 }) ? " active" : "")}
            title="Heading 1"
            onMouseDown={cmd(() => editor.chain().focus().toggleHeading({ level: 1 }).run())}
          ><span style={{ fontWeight: 700, fontSize: 12 }}>H1</span></button>

          <button
            className={"mtb-btn" + (editor.isActive("heading", { level: 2 }) ? " active" : "")}
            title="Heading 2"
            onMouseDown={cmd(() => editor.chain().focus().toggleHeading({ level: 2 }).run())}
          ><span style={{ fontWeight: 700, fontSize: 11 }}>H2</span></button>

          <div className="mtb-sep" />

          <button
            className={"mtb-btn" + (editor.isActive("bulletList") ? " active" : "")}
            title="Bullet list"
            onMouseDown={cmd(() => editor.chain().focus().toggleBulletList().run())}
          ><Icons.ListBullet size={13} /></button>

          <button
            className={"mtb-btn" + (editor.isActive("orderedList") ? " active" : "")}
            title="Numbered list"
            onMouseDown={cmd(() => editor.chain().focus().toggleOrderedList().run())}
          ><span style={{ fontSize: 11, fontFamily: "var(--font-mono)" }}>1.</span></button>

          <div className="mtb-sep" />

          <button
            className="mtb-btn"
            title="Insert table"
            onMouseDown={cmd(() => editor.chain().focus().insertTable({ rows: 3, cols: 3, withHeaderRow: true }).run())}
          ><Icons.TableIcon size={13} /></button>
        </div>
      )}
      <EditorContent editor={editor} className="meeting-prosemirror" />
    </div>
  );
});
