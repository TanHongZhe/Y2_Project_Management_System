'use client';

import React, { useState, useEffect, useRef } from 'react';
import { useQuery, useMutation, useAction } from 'convex/react';
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
import { MENTION_HANDLES, MENTION_MAP, MentionHandle, extractMentionedUserIds } from '../../lib/mentions';
import * as Icons from '../Icons';
import AudioPlayer from '../AudioPlayer';
import { marked } from 'marked';
import { DOMParser as PMDOMParser, Node as PMNode } from '@tiptap/pm/model';
import { Extension } from '@tiptap/core';
import { Plugin, PluginKey } from '@tiptap/pm/state';
import { Decoration, DecorationSet } from '@tiptap/pm/view';
import { useToast } from '../Toast';
import { wordCount, relativeTimestamp } from '../../lib/uiUtils';
import { MEETING_TEMPLATES } from '../../lib/meetingTemplates';

// ProseMirror plugin: paints any `@handle` that matches a known user with an
// amber class. Pure decoration — never touches the underlying markdown, so the
// stored content stays plain text and existing meetings remain readable.
const MENTION_REGEX = /@([a-zA-Z]+)/g;
const mentionDecorationKey = new PluginKey('mention-decoration');

function buildMentionDecorations(doc: PMNode): DecorationSet {
  const decos: Decoration[] = [];
  doc.descendants((node, pos) => {
    if (!node.isText || !node.text) return;
    const text = node.text;
    MENTION_REGEX.lastIndex = 0;
    let m: RegExpExecArray | null;
    while ((m = MENTION_REGEX.exec(text)) !== null) {
      const handle = m[1].toLowerCase();
      if (!MENTION_MAP[handle]) continue;
      const from = pos + m.index;
      const to = from + m[0].length;
      decos.push(Decoration.inline(from, to, { class: 'mention-token' }));
    }
  });
  return DecorationSet.create(doc, decos);
}

const MentionDecoration = Extension.create({
  name: 'mentionDecoration',
  addProseMirrorPlugins() {
    return [
      new Plugin({
        key: mentionDecorationKey,
        state: {
          init: (_config, state) => buildMentionDecorations(state.doc),
          apply: (tr, old) => (tr.docChanged ? buildMentionDecorations(tr.doc) : old),
        },
        props: {
          decorations(state) {
            return mentionDecorationKey.getState(state);
          },
        },
      }),
    ];
  },
});

interface MeetingsProps {
  currentUser: { id: string; name: string };
  readOnly?: boolean;
  searchBar?: React.ReactNode;
  selectedMeetingId?: string;
  onMeetingConsumed?: () => void;
  pendingRecord?: boolean;
  onRecordConsumed?: () => void;
}

interface MeetingEditorHandle {
  appendTranscript: (text: string) => void;
  setContent: (text: string) => void;
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

function NoteSources({ sources }: { sources: string[] }) {
  const [open, setOpen] = React.useState(false);
  return (
    <div className="citations-wrap">
      <button className="sources-toggle" onClick={() => setOpen((o) => !o)}>
        {open ? 'Hide sources' : `Show sources (${sources.length})`}
      </button>
      {open && (
        <div className="citations">
          {sources.map((src, i) => {
            const dashIdx = src.indexOf(' — ');
            const file = dashIdx !== -1 ? src.slice(0, dashIdx) : src;
            const section = dashIdx !== -1 ? src.slice(dashIdx + 3) : undefined;
            return (
              <span className="citation-chip" key={i}>
                <span className="num">{i + 1}</span>
                <span>{file}</span>
                {section && <span style={{ color: 'var(--text-faint)' }}>· {section}</span>}
              </span>
            );
          })}
        </div>
      )}
    </div>
  );
}

function MliAvatar({ user, title }: { user: { initials: string; color: string; avatarUrl?: string; name?: string; isAria?: boolean }; title?: string }) {
  const [failed, setFailed] = React.useState(false);
  if (user.isAria && user.avatarUrl && !failed) {
    return (
      <span className="mli-avatar mli-avatar-img" title={title}>
        <img src={user.avatarUrl} alt={user.name ?? user.initials} onError={() => setFailed(true)} />
      </span>
    );
  }
  return (
    <span className="mli-avatar" style={{ background: user.color }} title={title}>
      {user.initials}
    </span>
  );
}

export default function Meetings({ currentUser, readOnly, searchBar, selectedMeetingId, onMeetingConsumed, pendingRecord, onRecordConsumed }: MeetingsProps) {
  const meetings = useQuery(api.meetings.list, {});
  const memoryNotes = useQuery(api.memoryNotes.list, {});
  const create = useMutation(api.meetings.create);
  const update = useMutation(api.meetings.update);
  const remove = useMutation(api.meetings.remove);
  const upsertMemory = useMutation(api.memoryNotes.upsert);
  const generateAudioUploadUrl = useMutation(api.meetings.generateAudioUploadUrl);
  const saveAudio = useMutation(api.meetings.saveAudio);
  const deleteAudio = useMutation(api.meetings.deleteAudio);
  const syncMentions = useMutation(api.notifications.syncMentions);
  /* eslint-disable @typescript-eslint/no-explicit-any */
  const triggerAriaFromNote = useMutation((api as any).teamChat.triggerAriaFromNote);
  /* eslint-enable @typescript-eslint/no-explicit-any */
  const ingestNote = useAction(api.noteChunks.ingestNote);
  const toast = useToast();

  const [selectedId, setSelectedId] = useState<Id<"meetingNotes"> | null>(null);
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [attendees, setAttendees] = useState<string[]>([]);
  const [date, setDate] = useState(Date.now());
  const [syncing, setSyncing] = useState(false);
  const [syncMsg, setSyncMsg] = useState<{ text: string; ok: boolean } | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [pendingDeleteIds, setPendingDeleteIds] = useState<Set<string>>(new Set());
  const pendingDeleteTimers = useRef<Map<string, ReturnType<typeof setTimeout>>>(new Map());
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

  // Audio playback state — local URL is used for instant playback before the
  // upload completes; once `audioStorageId` is set we use the signed Convex URL.
  const [localAudioUrl, setLocalAudioUrl] = useState<string | null>(null);
  const [audioUploading, setAudioUploading] = useState(false);
  const [recordBlocked, setRecordBlocked] = useState(false);
  const mentionTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  // Separate timer for Aria trigger — 4s so the user finishes typing before it fires
  const ariaTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  // Tracks which note IDs have already triggered Aria this session (avoids re-firing on every keystroke)
  const ariaTriggeredNotes = useRef<Set<string>>(new Set());
  // Stores the pending Aria trigger so it can fire on unmount if debounce hasn't elapsed
  const pendingAriaRef = useRef<{ content: string; noteId: Id<"meetingNotes"> } | null>(null);
  // Auto-ingest into noteChunks: 30s debounce, flushes on selection change / unmount
  const ingestTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pendingIngestRef = useRef<{ id: Id<"meetingNotes">; content: string; section: string } | null>(null);
  const [ingestInFlight, setIngestInFlight] = useState(false);

  async function runIngest(id: Id<"meetingNotes">, content: string, section: string) {
    setIngestInFlight(true);
    try {
      await ingestNote({ noteId: id, content, section });
    } finally {
      setIngestInFlight(false);
    }
  }

  function schedulePendingIngest(id: Id<"meetingNotes">, content: string, section: string) {
    pendingIngestRef.current = { id, content, section };
    if (ingestTimerRef.current) clearTimeout(ingestTimerRef.current);
    ingestTimerRef.current = setTimeout(firePendingIngest, 30_000);
  }

  function firePendingIngest() {
    if (ingestTimerRef.current) { clearTimeout(ingestTimerRef.current); ingestTimerRef.current = null; }
    const p = pendingIngestRef.current;
    if (!p) return;
    pendingIngestRef.current = null;
    void runIngest(p.id, p.content, p.section);
  }
  // Tracks the last server content we've observed for the selected note. Used to
  // detect external edits (e.g. Aria appending/refining) so we can pull them into
  // the editor without clobbering an in-flight local save.
  const lastServerContentRef = useRef<string | null>(null);

  const canRecord = typeof window !== 'undefined' && typeof MediaRecorder !== 'undefined';

  const selectedMeeting = meetings?.find((m) => m._id === selectedId);
  const audioUrl = useQuery(
    api.meetings.getAudioUrl,
    selectedMeeting?.audioStorageId ? { storageId: selectedMeeting.audioStorageId } : 'skip',
  );
  // Stored hash from the noteChunks table — used to derive a persistent
  // "Indexed ✓" indicator that survives page reloads / navigation.
  const storedHash = useQuery(
    api.noteChunks.getStoredHash,
    selectedId ? { noteId: selectedId } : 'skip',
  );
  const [contentHash, setContentHash] = useState<string | null>(null);
  useEffect(() => {
    const text = (selectedMeeting?.content ?? '').trim();
    if (!text) { setContentHash(null); return; }
    let cancelled = false;
    void (async () => {
      const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text));
      const hex = Array.from(new Uint8Array(buf)).map((b) => b.toString(16).padStart(2, '0')).join('').slice(0, 16);
      if (!cancelled) setContentHash(hex);
    })();
    return () => { cancelled = true; };
  }, [selectedMeeting?.content]);
  const isIndexed = !!(storedHash && contentHash && storedHash === contentHash);
  const isSaved = !!(selectedMeeting && content === selectedMeeting.content);

  // 1 recording per meeting — disable Record once we have audio (locally or persisted).
  const hasAudio = !!selectedMeeting?.audioStorageId || !!localAudioUrl;
  const playerSrc = localAudioUrl ?? audioUrl ?? null;

  // Ctrl+Shift+R: create a new meeting and immediately start recording.
  // React Strict Mode fires this effect twice on mount — without the ref guard,
  // we'd create two meetings AND request two mic streams (only one of which
  // gets released on Stop, leaving the browser mic indicator stuck on).
  const autoRecordTriggered = useRef(false);
  useEffect(() => {
    if (!pendingRecord) {
      autoRecordTriggered.current = false;
      return;
    }
    if (autoRecordTriggered.current) return;
    if (readOnly || !canRecord) {
      onRecordConsumed?.();
      return;
    }
    autoRecordTriggered.current = true;
    void (async () => {
      const id = await create({
        title: `Meeting ${fmtDate(Date.now())}`,
        date: Date.now(),
        attendees: [currentUser.id],
        content: "",
        createdBy: currentUser.id,
      });
      setSelectedId(id as Id<"meetingNotes">);
      onRecordConsumed?.();
      await startRecording();
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pendingRecord]);

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
      lastServerContentRef.current = selectedMeeting.content;
      setAttendees(selectedMeeting.attendees);
      setDate(selectedMeeting.date);
      setSyncMsg(null);
      setTranscribeError(null);
    } else {
      lastServerContentRef.current = null;
    }
    // Clear local-only audio when switching meetings; the persisted URL takes over.
    setLocalAudioUrl((prev) => {
      if (prev) URL.revokeObjectURL(prev);
      return null;
    });
    setRecordBlocked(false);
  }, [selectedId]);

  // Flush any pending note ingest when selectedId changes or the component unmounts
  useEffect(() => {
    return () => { firePendingIngest(); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedId]);

  // Pull in external edits (Aria append/refine) when the server content changes
  // out from under us. Skips while a local save is pending so we don't clobber
  // an in-flight edit. Also re-arms the @aria-per-note guard so a fresh @aria
  // mention in an Aria-modified note can trigger again.
  useEffect(() => {
    if (!selectedMeeting || !selectedId) return;
    const serverContent = selectedMeeting.content;
    const prev = lastServerContentRef.current;
    if (prev === null) {
      lastServerContentRef.current = serverContent;
      return;
    }
    if (serverContent === prev) return;
    // Server content moved. If our local state already matches, this was our
    // own save being acknowledged — just update the tracker and bail.
    if (serverContent === content) {
      lastServerContentRef.current = serverContent;
      return;
    }
    // Don't pull while a local save is mid-flight; the user is mid-typing and
    // our save will land momentarily. The next server tick will reconcile.
    if (saveTimer.current || isSaving) return;
    lastServerContentRef.current = serverContent;
    setContent(serverContent);
    editorRef.current?.setContent(serverContent);
    // An Aria edit landed → allow @aria to fire again in this note this session.
    ariaTriggeredNotes.current.delete(selectedId as string);
  }, [selectedMeeting?.content, selectedId, content, isSaving]);

  // Stop recording and release mic on unmount
  useEffect(() => {
    return () => {
      if (recordTimerRef.current) clearInterval(recordTimerRef.current);
      if (mentionTimerRef.current) clearTimeout(mentionTimerRef.current);
      if (ariaTimerRef.current) {
        clearTimeout(ariaTimerRef.current);
        // Fire immediately if user navigated away before the debounce elapsed
        const pending = pendingAriaRef.current;
        if (pending && !ariaTriggeredNotes.current.has(pending.noteId as string)) {
          ariaTriggeredNotes.current.add(pending.noteId as string);
          pendingAriaRef.current = null;
          void triggerAriaFromNote({ authorId: currentUser.id, content: pending.content, noteId: pending.noteId });
        }
      }
      if (mediaRecorderRef.current) {
        mediaRecorderRef.current.onstop = null;
        try { mediaRecorderRef.current.stop(); } catch { /* already stopped */ }
        mediaRecorderRef.current.stream?.getTracks().forEach((t) => t.stop());
      }
      if (localAudioUrl) URL.revokeObjectURL(localAudioUrl);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function scheduleSave(patch: Partial<{ title: string; content: string; attendees: string[]; date: number }>) {
    if (!selectedId || readOnly) return;
    setIsSaving(true);
    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(() => {
      // Clear the handle so the external-sync effect can tell a save is no
      // longer pending (the ref is also used as the "save in flight" signal).
      saveTimer.current = null;
      void update({ id: selectedId!, ...patch, editorId: currentUser.id }).then(() => {
        setIsSaving(false);
      });
    }, 800);
  }

  // Debounced @mention sync — fires 1.2s after the last keystroke.
  // Compares the current set of mentioned users against what's stored and
  // creates / deletes notifications to keep them in sync.
  // Aria trigger uses a separate 4s debounce so the user has time to finish
  // their instruction before Aria starts generating.
  function scheduleMentionCheck(md: string) {
    if (!selectedId || readOnly) return;
    const meetingId = selectedId;
    const meetingTitle = title;

    // Human mention sync — 1.2s
    if (mentionTimerRef.current) clearTimeout(mentionTimerRef.current);
    mentionTimerRef.current = setTimeout(() => {
      const mentioned = extractMentionedUserIds(md, currentUser.id);
      const humanMentioned = mentioned.filter((id) => id !== 'aria');
      void syncMentions({
        linkId: meetingId as string,
        linkRoute: 'meetings',
        contextLabel: meetingTitle,
        fromUserId: currentUser.id,
        mentionedUserIds: humanMentioned,
      });
    }, 1200);

    // Aria trigger — 10s debounce, fires once per note per session (also fires on unmount)
    if (ariaTimerRef.current) clearTimeout(ariaTimerRef.current);
    const mentioned = extractMentionedUserIds(md, currentUser.id);
    if (mentioned.includes('aria') && !ariaTriggeredNotes.current.has(meetingId as string)) {
      pendingAriaRef.current = { content: md, noteId: meetingId as Id<"meetingNotes"> };
      ariaTimerRef.current = setTimeout(() => {
        pendingAriaRef.current = null;
        if (!ariaTriggeredNotes.current.has(meetingId as string)) {
          ariaTriggeredNotes.current.add(meetingId as string);
          void triggerAriaFromNote({
            authorId: currentUser.id,
            content: md,
            noteId: meetingId as Id<"meetingNotes">,
          });
        }
      }, 10000);
    } else {
      pendingAriaRef.current = null;
    }
  }

  async function handleDeleteAudio() {
    if (!selectedId) return;
    if (localAudioUrl) {
      URL.revokeObjectURL(localAudioUrl);
      setLocalAudioUrl(null);
    }
    if (selectedMeeting?.audioStorageId) {
      await deleteAudio({ id: selectedId });
    }
    setRecordBlocked(false);
  }

  async function handleCreate() {
    const id = await create({
      title: `Meeting ${fmtDate(Date.now())}`,
      date: Date.now(),
      attendees: [currentUser.id],
      content: "",
      createdBy: currentUser.id,
      source: "meeting",
    });
    setSelectedId(id as Id<"meetingNotes">);
  }

  async function handleCreateNote() {
    const id = await create({
      title: `Note ${fmtDate(Date.now())}`,
      date: Date.now(),
      attendees: [currentUser.id],
      content: "",
      createdBy: currentUser.id,
      source: "note",
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

  function handleDelete() {
    if (!selectedId) return;
    const id = selectedId;
    const label = meetings?.find(m => m._id === id)?.title ?? 'Meeting';
    // Optimistically hide and schedule real delete
    setPendingDeleteIds(s => new Set([...s, id as string]));
    setSelectedId(null);
    const timer = setTimeout(() => {
      void remove({ id });
      setPendingDeleteIds(s => { const n = new Set(s); n.delete(id as string); return n; });
      pendingDeleteTimers.current.delete(id as string);
    }, 5000);
    pendingDeleteTimers.current.set(id as string, timer);
    toast.info(`“${label}” deleted`, {
      duration: 5000,
      action: {
        label: 'Undo',
        onClick: () => {
          const t = pendingDeleteTimers.current.get(id as string);
          if (t) { clearTimeout(t); pendingDeleteTimers.current.delete(id as string); }
          setPendingDeleteIds(s => { const n = new Set(s); n.delete(id as string); return n; });
          setSelectedId(id);
        },
      },
    });
  }

  function flashRecordBlocked() {
    setRecordBlocked(true);
    setTimeout(() => setRecordBlocked(false), 2400);
  }

  async function startRecording() {
    if (hasAudio) {
      flashRecordBlocked();
      return;
    }
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

  // Splits accumulated 500 ms MediaRecorder chunks into blobs that each stay under
  // Whisper's 25 MB hard limit. chunks[0] is always the WebM initialization segment
  // (EBML header + codec metadata); it must be prepended to every subsequent group so
  // each blob is a self-contained, decodable WebM file.
  const WHISPER_MAX = 22 * 1024 * 1024; // 22 MB — leaves margin under the 25 MB cap
  function splitIntoWhisperChunks(chunks: Blob[], mimeType: string): Blob[] {
    const total = chunks.reduce((s, c) => s + c.size, 0);
    if (total <= WHISPER_MAX || chunks.length <= 1) return [new Blob(chunks, { type: mimeType })];
    const initChunk = chunks[0];
    const segments: Blob[] = [];
    let group: Blob[] = [initChunk];
    let groupSize = initChunk.size;
    for (const chunk of chunks.slice(1)) {
      if (groupSize + chunk.size > WHISPER_MAX && group.length > 1) {
        segments.push(new Blob(group, { type: mimeType }));
        group = [initChunk, chunk];
        groupSize = initChunk.size + chunk.size;
      } else {
        group.push(chunk);
        groupSize += chunk.size;
      }
    }
    if (group.length > 1 || segments.length === 0) segments.push(new Blob(group, { type: mimeType }));
    return segments;
  }

  async function handleRecordingStop() {
    if (chunksRef.current.length === 0) return;
    const mimeType = chunksRef.current[0]?.type || 'audio/webm';
    const segments = splitIntoWhisperChunks(chunksRef.current, mimeType);
    const blob = new Blob(chunksRef.current, { type: mimeType });
    chunksRef.current = [];

    // Instant local playback while the upload runs in the background.
    const localUrl = URL.createObjectURL(blob);
    setLocalAudioUrl(localUrl);

    const meetingIdForUpload = selectedId;
    if (meetingIdForUpload) {
      void (async () => {
        setAudioUploading(true);
        try {
          const uploadUrl = await generateAudioUploadUrl();
          const res = await fetch(uploadUrl, {
            method: 'POST',
            headers: { 'Content-Type': blob.type },
            body: blob,
          });
          if (!res.ok) throw new Error(`upload HTTP ${res.status}`);
          const { storageId } = (await res.json()) as { storageId: string };
          await saveAudio({
            id: meetingIdForUpload,
            audioStorageId: storageId as Id<'_storage'>,
          });
        } catch (e) {
          console.error('[audio-upload]', e);
        } finally {
          setAudioUploading(false);
        }
      })();
    }

    setTranscribing(true);
    setTranscribeError(null);
    try {
      const ext = mimeType.includes('ogg') ? 'ogg' : mimeType.includes('mp4') ? 'mp4' : 'webm';
      const transcripts: string[] = [];
      for (let i = 0; i < segments.length; i++) {
        const fd = new FormData();
        fd.append('audio', segments[i], `recording_part${i + 1}.${ext}`);
        const res = await fetch('/api/transcribe', { method: 'POST', body: fd });
        if (!res.ok) {
          const err = (await res.json().catch(() => ({ error: `HTTP ${res.status}` }))) as { error: string; detail?: string };
          console.error(`[transcribe] segment ${i + 1}/${segments.length} failed:`, err.error, err.detail ?? '');
          continue;
        }
        const data = (await res.json()) as { transcript: string };
        if (data.transcript?.trim()) transcripts.push(data.transcript.trim());
      }
      const raw = transcripts.join('\n\n');
      if (!raw) return;

      // Polish the combined transcript before inserting into notes
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
          <div className="crumb">Workspace · Notes</div>
          <h1>Notes</h1>
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
              <span className={"record-btn-wrap" + (recordBlocked ? " flash" : "") + (hasAudio ? " blocked" : "")}>
                <button
                  className={"btn sm" + (hasAudio ? " record-disabled" : "")}
                  disabled={!selectedId}
                  aria-disabled={hasAudio || !selectedId}
                  onClick={hasAudio ? flashRecordBlocked : startRecording}
                  onMouseEnter={() => { if (hasAudio) setRecordBlocked(true); }}
                  onMouseLeave={() => { if (hasAudio) setRecordBlocked(false); }}
                  title={
                    !selectedId
                      ? "Select a meeting first"
                      : hasAudio
                        ? "Only 1 recording per meeting — delete the existing one to record again"
                        : "Record meeting audio"
                  }
                >
                  <Icons.Mic size={13} /><span>Record</span>
                </button>
                {hasAudio && recordBlocked && (
                  <span className="record-blocked-tip" role="status">
                    Only 1 recording per meeting. Delete the existing recording first.
                  </span>
                )}
              </span>
            )
          )}
          {!readOnly && (
            <>
              <button className="btn sm" onClick={handleCreateNote}>
                <Icons.Plus size={13} /><span>New note</span>
              </button>
              <button className="btn primary sm" onClick={handleCreate}>
                <Icons.Plus size={13} /><span>New meeting</span>
              </button>
            </>
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
          {meetings?.filter(m => !pendingDeleteIds.has(m._id)).map((m) => {
            const now = Date.now();
            const ago = now - (m.updatedAt ?? m._creationTime ?? 0);
            const isMeeting = !m.source || m.source === 'meeting';
            const borderColor = ago < 86_400_000
              ? (isMeeting ? 'var(--warn)' : 'var(--accent)')
              : ago < 7 * 86_400_000 ? 'var(--line-strong)' : 'transparent';
            const creator = USERS.find(u => u.id === m.createdBy);
            const editors = (m.editedBy ?? [])
              .filter(id => id !== m.createdBy)
              .slice(0, 3)
              .map(id => USERS.find(u => u.id === id) ?? { id, initials: id.slice(0, 2).toUpperCase(), color: '#6b7280', name: id, avatarUrl: '' });
            return (
              <div
                key={m._id}
                className={"meeting-list-item" + (selectedId === m._id ? " active" : "") + (isMeeting ? " meeting-type" : "")}
                onClick={() => setSelectedId(m._id)}
                style={{ borderLeft: `3px solid ${borderColor}` }}
              >
                <div className="mli-title">
                  {m.title}
                  {m.source === 'aria' && (
                    <span className="mli-aria-badge">Aria</span>
                  )}
                </div>
                <div className="mli-date">
                  {m.updatedAt ? relativeTimestamp(m.updatedAt) + ' · ' : ''}{fmtDate(m.date)}
                </div>
                {(creator || editors.length > 0) && (
                  <div className="mli-collab">
                    {creator && (
                      <MliAvatar user={creator} title={`Created by ${creator.name}`} />
                    )}
                    {editors.length > 0 && (
                      <>
                        <span className="mli-collab-sep" />
                        {editors.map(e => (
                          <MliAvatar key={e.id} user={e} title={`Edited by ${e.name}`} />
                        ))}
                      </>
                    )}
                  </div>
                )}
              </div>
            );
          })}
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

              {selectedMeeting.source === 'note' || selectedMeeting.source === 'aria' ? (
                /* Notes: show creator + editors instead of attendees */
                <div className="meeting-attendees-row">
                  <div className="meeting-attendees-left note-collab-row">
                    {(() => {
                      const noteCreator = USERS.find(u => u.id === selectedMeeting.createdBy);
                      const noteEditors = (selectedMeeting.editedBy ?? [])
                        .filter(id => id !== selectedMeeting.createdBy)
                        .map(id => USERS.find(u => u.id === id) ?? { id, initials: id.slice(0, 2).toUpperCase(), color: '#6b7280', name: id, avatarUrl: '' });
                      return (
                        <>
                          <div className="note-collab-group">
                            <span className="note-collab-label">Creator</span>
                            {noteCreator
                              ? <MliAvatar user={noteCreator} title={noteCreator.name} />
                              : <span className="note-collab-empty">—</span>}
                          </div>
                          <div className="note-collab-group">
                            <span className="note-collab-label">Editors</span>
                            {noteEditors.length > 0
                              ? noteEditors.map(e => <MliAvatar key={e.id} user={e} title={e.name} />)
                              : <span className="note-collab-empty">None yet</span>}
                          </div>
                        </>
                      );
                    })()}
                  </div>
                </div>
              ) : (
                /* Meetings: full attendees picker + audio */
                <div className="meeting-attendees-row">
                  <div className="meeting-attendees-left">
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
                  {playerSrc && (
                    <div className="meeting-audio-wrap">
                      <AudioPlayer
                        src={playerSrc}
                        uploading={audioUploading}
                        filename={`${title || 'recording'}.webm`}
                      />
                      {!readOnly && (
                        <button
                          className="ap-btn ap-delete"
                          title="Delete recording (lets you record again)"
                          onClick={handleDeleteAudio}
                        >
                          <Icons.Trash size={13} />
                        </button>
                      )}
                    </div>
                  )}
                </div>
              )}

              <MeetingEditor
                ref={editorRef}
                key={selectedId}
                initialContent={selectedMeeting.content}
                readOnly={readOnly}
                currentUserId={currentUser.id}
                onChange={(md) => {
                  setContent(md);
                  scheduleSave({ content: md });
                  scheduleMentionCheck(md);
                  if (selectedId) schedulePendingIngest(selectedId, md, title);
                }}
              />

              {/* Template picker — appears for new/empty meetings */}
              {!readOnly && !content.trim() && (
                <div className="template-strip">
                  <span className="template-strip-label">Start from a template:</span>
                  {MEETING_TEMPLATES.map(t => (
                    <button
                      key={t.id}
                      className="btn ghost sm"
                      onClick={() => {
                        setContent(t.content);
                        editorRef.current?.setContent(t.content);
                        scheduleSave({ content: t.content });
                      }}
                    >
                      {t.icon} {t.label}
                    </button>
                  ))}
                </div>
              )}

              <div className="meeting-footer-row">
                <div className="meeting-footer-left">
                  {!readOnly && (
                    <button className="btn sm" style={{ color: "var(--danger)" }} onClick={handleDelete}>
                      Delete
                    </button>
                  )}
                </div>
                <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
                  {!readOnly && (
                    <span
                      aria-live="polite"
                      style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: ingestInFlight ? 'var(--text-muted)' : 'var(--accent, #22c55e)', minWidth: 60, textAlign: 'right' }}
                    >
                      {ingestInFlight ? 'Indexing…' : isIndexed ? 'Indexed ✓' : ''}
                    </span>
                  )}
                  {!readOnly && (
                    <span
                      aria-live="polite"
                      style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: isSaving ? 'var(--text-muted)' : 'var(--accent, #22c55e)', minWidth: 52, textAlign: 'right' }}
                    >
                      {isSaving ? 'Saving…' : isSaved ? 'Saved ✓' : ''}
                    </span>
                  )}
                  {selectedMeeting.sources && selectedMeeting.sources.length > 0 && (
                    <NoteSources sources={selectedMeeting.sources} />
                  )}
                  {content.trim() && (
                    <span style={{ fontSize: 11, color: 'var(--text-faint)', fontFamily: 'var(--font-mono)' }}>
                      {wordCount(content)} words · ~{Math.ceil(wordCount(content) / 200)} min read
                    </span>
                  )}
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
  currentUserId?: string;
}>(function MeetingEditor({ initialContent, readOnly, onChange, currentUserId }, ref) {
  // @ mention dropdown — when the cursor sits right after `@<word>`, a list of
  // matching team members appears so the user can insert the canonical handle
  // (and trigger a notification once the debounced scan runs upstream).
  interface MentionUIState {
    from: number;          // doc position of the `@`
    query: string;
    index: number;
    filtered: MentionHandle[];
    coords: { left: number; top: number };
    placement: 'below' | 'above';
  }
  const [mention, setMention] = React.useState<MentionUIState | null>(null);
  const mentionRef = React.useRef<MentionUIState | null>(null);
  mentionRef.current = mention;

  const closeMention = React.useCallback(() => {
    mentionRef.current = null;
    setMention(null);
  }, []);

  const editor = useEditor({
    extensions: [
      StarterKit,
      Table.configure({ resizable: false }),
      TableRow,
      TableHeader,
      TableCell,
      Markdown.configure({ html: false, transformPastedText: true }),
      MentionDecoration,
    ],
    content: initialContent,
    editable: !readOnly,
    editorProps: {
      handleKeyDown(_view, event) {
        const m = mentionRef.current;
        if (!m || m.filtered.length === 0) return false;
        if (event.key === 'ArrowDown') {
          event.preventDefault();
          const next = (m.index + 1) % m.filtered.length;
          mentionRef.current = { ...m, index: next };
          setMention(mentionRef.current);
          return true;
        }
        if (event.key === 'ArrowUp') {
          event.preventDefault();
          const next = (m.index - 1 + m.filtered.length) % m.filtered.length;
          mentionRef.current = { ...m, index: next };
          setMention(mentionRef.current);
          return true;
        }
        if (event.key === 'Enter' || event.key === 'Tab') {
          event.preventDefault();
          insertMention(m.filtered[m.index].handle);
          return true;
        }
        if (event.key === 'Escape') {
          event.preventDefault();
          closeMention();
          return true;
        }
        return false;
      },
    },
    onUpdate({ editor }) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const md = (editor.storage as unknown as { markdown: { getMarkdown: () => string } }).markdown.getMarkdown();
      onChange(md);
      detectMention(editor);
    },
    onSelectionUpdate({ editor }) {
      detectMention(editor);
    },
    onBlur() {
      // Slight delay so dropdown clicks can still register before close.
      setTimeout(() => closeMention(), 120);
    },
  });

  function detectMention(ed: NonNullable<typeof editor>) {
    const sel = ed.state.selection;
    if (sel.from !== sel.to) { closeMention(); return; }
    const $from = ed.state.doc.resolve(sel.from);
    const blockStart = $from.start();
    const before = ed.state.doc.textBetween(blockStart, sel.from, '\n', '\n');
    // Match `@word` at end of text, allowing it to follow start-of-block, whitespace, or punctuation.
    const match = before.match(/(?:^|[\s(\[{"'`])@([a-zA-Z]*)$/);
    if (!match) { closeMention(); return; }
    const query = match[1].toLowerCase();
    const atPos = sel.from - match[1].length - 1;
    const filtered = query
      ? MENTION_HANDLES.filter((h) => h.handle.startsWith(query) || h.name.toLowerCase().includes(query))
      : MENTION_HANDLES;
    if (filtered.length === 0) { closeMention(); return; }
    const coords = ed.view.coordsAtPos(atPos);
    // Dropdown rows are ~34px tall plus 8px padding; clamp to a reasonable max.
    const estHeight = Math.min(filtered.length * 34 + 8, 260);
    const viewportH = window.innerHeight;
    const spaceBelow = viewportH - coords.bottom;
    const spaceAbove = coords.top;
    const placeAbove = spaceBelow < estHeight + 12 && spaceAbove > spaceBelow;
    const top = placeAbove ? Math.max(8, coords.top - estHeight - 4) : coords.bottom + 4;
    const next: MentionUIState = {
      from: atPos,
      query,
      index: 0,
      filtered,
      coords: { left: coords.left, top },
      placement: placeAbove ? 'above' : 'below',
    };
    mentionRef.current = next;
    setMention(next);
  }

  function insertMention(handle: string) {
    const m = mentionRef.current;
    if (!m || !editor) return;
    const to = editor.state.selection.from;
    editor.chain().focus().insertContentAt({ from: m.from, to }, `@${handle} `).run();
    closeMention();
  }

  React.useImperativeHandle(ref, () => ({
    appendTranscript: (text: string) => {
      if (!editor) return;
      const html = marked.parse(text) as string;

      // Parse HTML → ProseMirror nodes, then pass as JSON to insertContentAt.
      // JSON bypasses tiptap-markdown's html:false restriction (which causes HTML
      // strings to be treated as plain text regardless of the insertion method used).
      const wrapper = document.createElement('div');
      wrapper.innerHTML = html;
      const parsed = PMDOMParser.fromSchema(editor.state.schema).parse(wrapper, {
        preserveWhitespace: false,
      });
      const jsonNodes = [
        { type: 'horizontalRule' },
        ...(parsed.toJSON().content as object[]),
      ];

      editor.chain().focus().insertContentAt(editor.state.doc.content.size, jsonNodes).run();
    },
    setContent: (text: string) => {
      if (!editor) return;
      editor.commands.setContent(text);
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
      {mention && mention.filtered.length > 0 && (
        <div
          className={"mention-dropdown mention-" + mention.placement}
          style={{ left: mention.coords.left, top: mention.coords.top }}
          onMouseDown={(e) => e.preventDefault()}
        >
          {mention.filtered.map((m, i) => {
            const isSelf = m.userId === currentUserId;
            return (
              <button
                key={m.userId}
                type="button"
                className={
                  'mention-item' +
                  (i === mention.index ? ' active' : '') +
                  (m.isBroadcast ? ' mention-broadcast' : '')
                }
                onMouseEnter={() => {
                  if (mentionRef.current) {
                    mentionRef.current = { ...mentionRef.current, index: i };
                    setMention(mentionRef.current);
                  }
                }}
                onClick={() => insertMention(m.handle)}
                title={
                  m.isBroadcast
                    ? 'Notify everyone on the team'
                    : isSelf
                      ? "That's you — won't notify yourself"
                      : `Notify ${m.name}`
                }
              >
                <span className="mention-avatar" style={{ background: m.color }}>
                  {m.isBroadcast ? '@' : m.initials}
                </span>
                <span className="mention-name">
                  {m.name}
                  {isSelf && <span className="mention-you"> (you)</span>}
                </span>
                <span className="mention-handle">@{m.handle}</span>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
});
