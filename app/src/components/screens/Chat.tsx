'use client';

import React, { useState, useEffect, useRef, useMemo } from 'react';
import { useQuery, useMutation } from 'convex/react';
import { api } from '../../../convex/_generated/api';
import { Id, Doc } from '../../../convex/_generated/dataModel';
import { MODELS } from '@/lib/models';
import { renderMarkdown } from '@/lib/markdown';
import * as Icons from '../Icons';

interface Tweaks {
  theme: string;
  accent: string;
  density: string;
  surface: string;
  dense: boolean;
  debug: boolean;
}

interface ChatProps {
  tweaks: Tweaks;
  setRoute: (r: string) => void;
  selectedThreadId: string | null;
  onSelectThread: (id: string | null) => void;
  userId: string;
}

interface StreamingTool {
  id: string;
  name: string;
  args: string;
  status: "pending" | "applied" | "error";
  result?: string;
}

interface PendingAssistant {
  content: string;
  citations: Array<{ file: string; section?: string; url?: string; score?: number; sent?: boolean }>;
  toolCalls: StreamingTool[];
  usage?: { prompt_tokens?: number; completion_tokens?: number; total_tokens?: number } | null;
}

function ModelIcon({ model }: { model?: string | null }) {
  if (model?.startsWith("xiaomi/")) {
    return (
      <svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg" width="32" height="32" aria-label="Xiaomi" fill="currentColor">
        <path fillRule="evenodd" d="M3.5 0H20.5A3.5 3.5 0 0 1 24 3.5V20.5A3.5 3.5 0 0 1 20.5 24H3.5A3.5 3.5 0 0 1 0 20.5V3.5A3.5 3.5 0 0 1 3.5 0ZM4.906 7.405h5.624c1.47 0 3.007.068 3.764.827.746.746.827 2.233.83 3.676v4.54a.15.15 0 0 1-.152.147h-1.947a.15.15 0 0 1-.152-.148V11.83c-.002-.806-.048-1.634-.464-2.051-.358-.36-1.026-.441-1.72-.458H7.158a.15.15 0 0 0-.151.147v6.98a.15.15 0 0 1-.152.148H4.906a.15.15 0 0 1-.15-.148V7.554a.15.15 0 0 1 .15-.149zm12.131 0h1.949a.15.15 0 0 1 .15.15v8.892a.15.15 0 0 1-.15.148h-1.949a.15.15 0 0 1-.151-.148V7.554a.15.15 0 0 1 .151-.149zM8.92 10.948h2.046c.083 0 .15.066.15.147v5.352a.15.15 0 0 1-.15.148H8.92a.15.15 0 0 1-.152-.148v-5.352a.15.15 0 0 1 .152-.147Z"/>
      </svg>
    );
  }
  if (model?.startsWith("anthropic/")) {
    return (
      <svg fill="currentColor" fillRule="evenodd" viewBox="0 0 24 24" width="18" height="18" xmlns="http://www.w3.org/2000/svg" aria-label="Anthropic">
        <path d="M13.827 3.52h3.603L24 20h-3.603l-6.57-16.48zm-7.258 0h3.767L16.906 20h-3.674l-1.343-3.461H5.017l-1.344 3.46H0L6.57 3.522zm4.132 9.959L8.453 7.687 6.205 13.48H10.7z"/>
      </svg>
    );
  }
  return <>AI</>;
}

function MessageBubble({
  role,
  content,
  model,
  toolCalls,
  citations,
  streaming,
  usage,
}: {
  role: "user" | "assistant" | "system";
  content: string;
  model?: string | null;
  toolCalls?: Array<{
    name: string;
    args: string;
    status: "pending" | "applied" | "error";
    result?: string;
  }>;
  citations?: Array<{ file: string; section?: string; url?: string; score?: number; sent?: boolean }>;
  streaming?: boolean;
  usage?: { prompt_tokens?: number; completion_tokens?: number; total_tokens?: number } | null;
}) {
  const isUser = role === "user";
  const [showSources, setShowSources] = useState(false);
  return (
    <div className="msg-row">
      <div className={"msg-avatar " + (isUser ? "user" : "ai")}>{isUser ? "ME" : <ModelIcon model={model} />}</div>
      <div className="msg-body">
        <div className="msg-meta">
          <span className="role">{isUser ? "You" : "Assistant"}</span>
          {model && <span className="model-tag">{model}</span>}
          {usage?.total_tokens && (
            <span className="token-badge" title={`${usage.prompt_tokens ?? "?"} prompt + ${usage.completion_tokens ?? "?"} completion`}>
              {usage.total_tokens.toLocaleString()} tok
            </span>
          )}
        </div>
        <div className="msg-content">{renderMarkdown(content, streaming)}</div>

        {toolCalls && toolCalls.length > 0 && (
          <div style={{ display: "grid", gap: 6, marginTop: 8 }}>
            {toolCalls.map((tc, i) => (
              <div className="tool-call" key={i}>
                <div className="head">
                  <Icons.Branch size={12} />
                  <span className="name">{tc.name}</span>
                  <span style={{ color: "var(--text-faint)" }}>
                    ({summariseArgs(tc.args)})
                  </span>
                  <span className="status">
                    <span className="dot" style={{ background: tc.status === "applied" ? "var(--accent)" : tc.status === "error" ? "#c66" : "var(--text-faint)" }} />
                    {tc.status}
                  </span>
                </div>
                {tc.result && (
                  <div className="body-tc">
                    <span className="added">{tc.result}</span>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}

        {citations && citations.length > 0 && (
          <div className="citations-wrap">
            <button className="sources-toggle" onClick={() => setShowSources(s => !s)}>
              {showSources ? "Hide sources" : `Show sources (${citations.length})`}
            </button>
            {showSources && (
              <div className="citations">
                {citations.map((c, i) => (
                  <span
                    className="citation-chip"
                    key={i}
                    title={c.url ?? c.file}
                    style={c.sent === false ? { opacity: 0.4 } : undefined}
                  >
                    <span className="num">{i + 1}</span>
                    <span>{c.file}</span>
                    {c.section && <span style={{ color: "var(--text-faint)" }}>· {c.section}</span>}
                    {c.score !== undefined && (
                      <span style={{ color: "var(--text-faint)", fontSize: "0.82em" }}>
                        {c.sent === false ? "✗" : ""} {c.score.toFixed(2)}
                      </span>
                    )}
                  </span>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

function summariseArgs(rawArgs: string): string {
  try {
    const parsed = JSON.parse(rawArgs);
    if (parsed && typeof parsed === "object") {
      if ("title" in parsed) return String(parsed.title).slice(0, 60);
      if ("section" in parsed) return `section: ${parsed.section}`;
      if ("name" in parsed) return String(parsed.name).slice(0, 60);
    }
    return rawArgs.slice(0, 80);
  } catch {
    return rawArgs.slice(0, 80);
  }
}

const GUEST_LIMIT = 3;
const GUEST_KEY = "pms-guest-chat";

function readGuestUsage(): { count: number; resetAt: number } {
  try {
    const raw = localStorage.getItem(GUEST_KEY);
    if (raw) {
      const d = JSON.parse(raw);
      if (Date.now() > d.resetAt) return { count: 0, resetAt: Date.now() + 86400000 };
      return d;
    }
  } catch {}
  return { count: 0, resetAt: Date.now() + 86400000 };
}

function bumpGuestUsage(): void {
  const u = readGuestUsage();
  try { localStorage.setItem(GUEST_KEY, JSON.stringify({ count: u.count + 1, resetAt: u.resetAt })); } catch {}
}

export default function Chat({ tweaks, setRoute: _setRoute, selectedThreadId, onSelectThread, userId }: ChatProps) {
  const isGuest = userId === "guest";
  void _setRoute;
  const threads = useQuery(api.threads.list, { limit: 30, userId });
  const createThread = useMutation(api.threads.create);
  const removeThread = useMutation(api.threads.remove);

  const threadId = (selectedThreadId as Id<"threads"> | null) ?? threads?.[0]?._id ?? null;

  const messages = useQuery(api.messages.listByThread, threadId ? { threadId } : "skip");

  const [guestUsage, setGuestUsage] = useState(() => isGuest ? readGuestUsage() : { count: 0, resetAt: 0 });
  const guestRemaining = Math.max(0, GUEST_LIMIT - guestUsage.count);

  const [boost, setBoost] = useState(false);
  const [showDebug, setShowDebug] = useState(false);
  const [railTab, setRailTab] = useState("memory");
  const [draft, setDraft] = useState("");
  const [streaming, setStreaming] = useState(false);
  const [pending, setPending] = useState<PendingAssistant | null>(null);
  const [attachedImages, setAttachedImages] = useState<string[]>([]);
  const [attachedFiles, setAttachedFiles] = useState<Array<{ name: string; content: string }>>([]);
  const [fileLoading, setFileLoading] = useState(false);
  const taRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const abortRef = useRef<AbortController | null>(null);

  // Abort any in-flight stream on unmount
  useEffect(() => {
    return () => { abortRef.current?.abort(); };
  }, []);

  const memoryNotes = useQuery(api.memoryNotes.list, {});
  const recentDecisions = useQuery(api.decisions.list, { limit: 5 });
  const recentDocs = useQuery(api.documents.list, { limit: 8 });

  async function newThread() {
    const id = await createThread({ title: "New session", userId });
    onSelectThread(String(id));
    setPending(null);
  }

  async function deleteCurrent() {
    if (!threadId) return;
    await removeThread({ threadId });
    onSelectThread(null);
    setPending(null);
  }

  async function handleSend() {
    const userText = draft.trim();
    if (!userText || streaming || fileLoading) return;
    if (isGuest) {
      const usage = readGuestUsage();
      if (usage.count >= GUEST_LIMIT) return;
      bumpGuestUsage();
      setGuestUsage(readGuestUsage());
    }
    setDraft("");
    if (taRef.current) taRef.current.style.height = "auto";
    setAttachedImages([]);
    setAttachedFiles([]);

    const isFirstMessage = (messages ?? []).length === 0;

    let activeThreadId = threadId;
    if (!activeThreadId) {
      activeThreadId = (await createThread({ title: "New session", userId })) as Id<"threads">;
      onSelectThread(String(activeThreadId));
    }

    if (isFirstMessage && activeThreadId) {
      const tid = activeThreadId;
      fetch("/api/title", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: userText, threadId: String(tid) }),
      }).catch(() => {});
    }

    setStreaming(true);
    setPending({ content: "", citations: [], toolCalls: [] });

    abortRef.current?.abort();
    const ctrl = new AbortController();
    abortRef.current = ctrl;

    type ApiContent = string | Array<{ type: "text"; text: string } | { type: "image_url"; image_url: { url: string } }>;
    const apiMessages: Array<{ role: "user" | "assistant" | "system"; content: ApiContent }> = (messages ?? []).map((m) => {
      let content: string = m.content;
      if (m.role === "assistant" && m.toolCalls && m.toolCalls.length > 0) {
        const done = m.toolCalls.filter(tc => tc.status !== "pending");
        if (done.length > 0) {
          const summary = done.map(tc => `[${tc.name}: ${tc.result ?? tc.status}]`).join("\n");
          content = content ? `${content}\n\n${summary}` : summary;
        }
      }
      return { role: m.role, content };
    });

    // Build the outgoing user content (text + any attachments)
    let userContent: ApiContent = userText;
    if (attachedFiles.length > 0) {
      const fileCtx = attachedFiles.map(f => `=== Attached: ${f.name} ===\n${f.content}`).join("\n\n");
      userContent = `${fileCtx}\n\n${userText}`;
    }
    if (attachedImages.length > 0) {
      const textPart = typeof userContent === "string" ? userContent : userText;
      const parts: Array<{ type: "text"; text: string } | { type: "image_url"; image_url: { url: string } }> = [
        { type: "text", text: textPart },
        ...attachedImages.slice(0, 4).map(url => ({ type: "image_url" as const, image_url: { url } })),
      ];
      userContent = parts;
    }

    apiMessages.push({ role: "user", content: userContent });

    try {
      let temperature = 0.3;
      let maxTokens = 4096;
      try {
        const t = localStorage.getItem("pms-temp");
        const m = localStorage.getItem("pms-max-tokens");
        if (t !== null) temperature = parseInt(t) / 100;
        if (m !== null) maxTokens = parseInt(m);
      } catch {}

      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          model: boost ? "boost" : "flash",
          threadId: activeThreadId,
          messages: apiMessages,
          temperature,
          maxTokens,
        }),
        signal: ctrl.signal,
      });

      if (!res.ok || !res.body) {
        const detail = await res.text().catch(() => "");
        setPending({
          content: `⚠️ Request failed (${res.status}). ${detail.slice(0, 240)}`,
          citations: [],
          toolCalls: [],
        });
        setStreaming(false);
        return;
      }

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";

      while (true) {
        const { value, done } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop() ?? "";

        for (const raw of lines) {
          const line = raw.trim();
          if (!line.startsWith("data:")) continue;
          const payload = line.slice(5).trim();
          if (!payload) continue;
          let evt: unknown;
          try {
            evt = JSON.parse(payload);
          } catch {
            continue;
          }
          if (typeof evt !== "object" || evt === null) continue;
          const obj = evt as Record<string, unknown>;
          const type = obj.type;
          if (type === "content" && typeof obj.delta === "string") {
            const delta = obj.delta;
            setPending(prev => prev ? { ...prev, content: prev.content + delta } : prev);
          } else if (type === "citations" && Array.isArray(obj.citations)) {
            const citations = obj.citations as Array<{ file: string; section?: string; url?: string; score?: number; sent?: boolean }>;
            setPending(prev => prev ? { ...prev, citations } : prev);
          } else if (type === "tool_call") {
            const toolCall: StreamingTool = {
              id: String(obj.id ?? ""),
              name: String(obj.name ?? ""),
              args: String(obj.args ?? ""),
              status: (obj.status === "applied" || obj.status === "error" ? obj.status : "pending") as StreamingTool["status"],
              result: typeof obj.result === "string" ? obj.result : undefined,
            };
            setPending(prev => {
              if (!prev) return prev;
              const exists = prev.toolCalls.find(t => t.id === toolCall.id);
              const toolCalls = exists
                ? prev.toolCalls.map(t => t.id === toolCall.id ? toolCall : t)
                : [...prev.toolCalls, toolCall];
              return { ...prev, toolCalls };
            });
          } else if (type === "error") {
            const msg = String(obj.message ?? "Stream error");
            setPending(prev => prev ? { ...prev, content: prev.content + `\n\n⚠️ ${msg}` } : prev);
          } else if (type === "done") {
            const usageData = obj.usage as { prompt_tokens?: number; completion_tokens?: number; total_tokens?: number } | null | undefined;
            if (usageData) {
              setPending(prev => prev ? { ...prev, usage: usageData } : prev);
            }
          }
        }
      }
    } catch (err) {
      if (err instanceof Error && err.name === "AbortError") return;
      const msg = err instanceof Error ? err.message : "Network error";
      setPending(prev => prev ? { ...prev, content: prev.content + `\n\n⚠️ ${msg}` } : { content: `⚠️ ${msg}`, citations: [], toolCalls: [] });
    } finally {
      setStreaming(false);
      setTimeout(() => setPending(null), 1500);
    }
  }

  useEffect(() => {
    if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
  }, [pending, messages, streaming]);

  function onKey(e: React.KeyboardEvent) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      void handleSend();
    }
  }

  function onInput(e: React.ChangeEvent<HTMLTextAreaElement>) {
    setDraft(e.target.value);
    const el = e.target;
    el.style.height = "auto";
    el.style.height = Math.min(200, el.scrollHeight) + "px";
  }

  function onComposerPaste(e: React.ClipboardEvent) {
    const items = Array.from(e.clipboardData?.items ?? []);
    for (const item of items) {
      if (item.type.startsWith("image/")) {
        e.preventDefault();
        const file = item.getAsFile();
        if (!file) continue;
        const reader = new FileReader();
        reader.onload = () => {
          if (typeof reader.result === "string") {
            setAttachedImages(prev => [...prev, reader.result as string]);
          }
        };
        reader.readAsDataURL(file);
      }
    }
  }

  async function onFileSelect(e: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(e.target.files ?? []);
    e.target.value = "";
    if (files.length === 0) return;
    setFileLoading(true);
    try {
      for (const file of files) {
        if (file.name.toLowerCase().endsWith(".pdf")) {
          const fd = new FormData();
          fd.append("file", file);
          const res = await fetch("/api/extract-text", { method: "POST", body: fd });
          if (res.ok) {
            const { text } = (await res.json()) as { text: string };
            setAttachedFiles(prev => [...prev, { name: file.name, content: text }]);
          }
        } else {
          const text = await file.text();
          setAttachedFiles(prev => [...prev, { name: file.name, content: text }]);
        }
      }
    } finally {
      setFileLoading(false);
    }
  }

  const currentThread = useMemo(
    () => threads?.find(t => t._id === threadId) ?? null,
    [threads, threadId],
  );

  return (
    <>
      <header className="screen-header">
        <div className="title-block">
          <div className="crumb">Workspace · Chat</div>
          <h1>{currentThread?.title ?? "New session"}</h1>
        </div>
        <div className="actions">
          <button className={"btn ghost sm" + (showDebug ? " primary" : "")} onClick={() => setShowDebug(s => !s)}>
            {showDebug ? <Icons.EyeOff /> : <Icons.Eye />}
            <span>Show context</span>
          </button>
          <button className="btn ghost icon-only" title="New thread" onClick={() => void newThread()}>
            <Icons.Plus />
          </button>
          {threadId && (
            <button className="btn ghost icon-only" title="Delete thread" onClick={() => void deleteCurrent()}>
              <Icons.Trash />
            </button>
          )}
        </div>
      </header>

      <div className={"chat-layout" + (tweaks.dense ? " no-rail" : "")}>
        <div className="chat-col">
          <div className="chat-scroll" ref={scrollRef}>
            {showDebug && (
              <div className="debug-pane">
                <div><span className="lbl">RAG context wired</span></div>
                <div style={{ marginTop: 6 }}>
                  <span className="hl">system</span>: project copilot, tool calling enabled.{" "}
                  <span className="hl">tools</span>: log_decision, add_component, update_memory, log_test_result{" "}
                  <span className="hl">retrieval</span>: top-8 vector search over chunks + pinned memory + last 5 decisions{" "}
                  <span className="hl">model</span>: {boost ? MODELS.boost.id : MODELS.flash.id}
                </div>
              </div>
            )}

            <div className="chat-thread">
              {messages && messages.length === 0 && !pending && (
                <div style={{ padding: "40px 20px", color: "var(--text-muted)", textAlign: "center" }}>
                  Start by asking a question or telling the assistant what you decided, measured, or learned.
                </div>
              )}

              {messages?.map((m: Doc<"messages">) => (
                <MessageBubble
                  key={m._id}
                  role={m.role}
                  content={m.content}
                  model={m.model}
                  toolCalls={m.toolCalls?.map(tc => ({
                    name: tc.name,
                    args: tc.args,
                    status: tc.status,
                    result: tc.result,
                  }))}
                  citations={m.citations}
                />
              ))}

              {pending && (
                <MessageBubble
                  role="assistant"
                  content={pending.content || (streaming ? "…" : "")}
                  model={boost ? MODELS.boost.id : MODELS.flash.id}
                  toolCalls={pending.toolCalls}
                  citations={pending.citations}
                  streaming={streaming}
                  usage={pending.usage}
                />
              )}
            </div>
          </div>

          <div className="composer-wrap">
            <div className="composer" onPaste={onComposerPaste}>
              {(attachedImages.length > 0 || attachedFiles.length > 0) && (
                <div className="attachment-bar">
                  {attachedImages.map((src, i) => (
                    <div className="attach-img" key={i}>
                      <img src={src} alt="attachment" />
                      <button className="rm" onClick={() => setAttachedImages(prev => prev.filter((_, j) => j !== i))} title="Remove">
                        <Icons.X size={9} />
                      </button>
                    </div>
                  ))}
                  {attachedFiles.map((f, i) => (
                    <div className="attach-file" key={i}>
                      <Icons.File size={11} />
                      <span className="fname">{f.name}</span>
                      <button className="rm" onClick={() => setAttachedFiles(prev => prev.filter((_, j) => j !== i))} title="Remove">
                        <Icons.X size={10} />
                      </button>
                    </div>
                  ))}
                  {fileLoading && (
                    <div className="attach-file">
                      <Icons.File size={11} />
                      <span className="fname">Extracting…</span>
                    </div>
                  )}
                </div>
              )}
              <textarea
                ref={taRef}
                placeholder={isGuest && guestRemaining === 0 ? "Message limit reached — resets in 24 hrs" : "Ask about the project, or describe a decision to log…"}
                value={draft}
                onChange={onInput}
                onKeyDown={onKey}
                disabled={isGuest && guestRemaining === 0}
              />
              <div className="composer-bar">
                <div className="left">
                  {isGuest ? (
                    guestRemaining === 0 ? (
                      <span className="guest-chat-exhausted">No messages left · Resets in 24 hrs</span>
                    ) : (
                      <span className="guest-chat-info">
                        <strong>{guestRemaining}</strong> message{guestRemaining !== 1 ? "s" : ""} left
                        <span className="sub"> · Guests are limited to {GUEST_LIMIT} messages every 24 hrs</span>
                      </span>
                    )
                  ) : (
                    <>
                      <div className="model-picker">
                        <button className={!boost ? "active" : ""} onClick={() => setBoost(false)} title={MODELS.flash.id}>
                          <span>{MODELS.flash.label}</span><span className="price">{MODELS.flash.id.split("/")[1] ?? ""}</span>
                        </button>
                        <button className={"boost " + (boost ? "active" : "")} onClick={() => setBoost(true)} title={MODELS.boost.id}>
                          <Icons.Bolt size={11} /><span>{MODELS.boost.label}</span><span className="price">{MODELS.boost.id.split("/")[1] ?? ""}</span>
                        </button>
                      </div>
                      <button
                        className="btn ghost icon-only sm"
                        title="Attach file or PDF"
                        onClick={() => fileInputRef.current?.click()}
                        disabled={streaming || fileLoading}
                      >
                        <Icons.Paperclip size={13} />
                      </button>
                      <input
                        ref={fileInputRef}
                        type="file"
                        accept=".pdf,.txt,.md,.json,.csv"
                        multiple
                        style={{ display: "none" }}
                        onChange={(e) => void onFileSelect(e)}
                      />
                    </>
                  )}
                </div>
                <div className="right">
                  {!isGuest && <span className="hint">{boost ? MODELS.boost.id : MODELS.flash.id}</span>}
                  <button className="btn primary sm" onClick={() => void handleSend()} disabled={!draft.trim() || streaming || fileLoading || (isGuest && guestRemaining === 0)}>
                    <Icons.Send size={12} />
                    <span>{streaming ? "…" : "Send"}</span>
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>

        {!tweaks.dense && (
          <aside className="chat-rail">
            <div className="rail-tabs">
              <button className={railTab === "memory" ? "active" : ""} onClick={() => setRailTab("memory")}>Memory</button>
              <button className={railTab === "threads" ? "active" : ""} onClick={() => setRailTab("threads")}>Threads</button>
              <button className={railTab === "sources" ? "active" : ""} onClick={() => setRailTab("sources")}>Sources</button>
            </div>
            <div className="rail-scroll">
              {railTab === "memory" && (
                <>
                  <div className="rail-section">
                    <h4>Pinned <span className="badge">{memoryNotes?.length ?? 0}</span></h4>
                    {(!memoryNotes || memoryNotes.length === 0) && (
                      <div className="item" style={{ color: "var(--text-faint)" }}>
                        No memory notes yet.
                      </div>
                    )}
                    {memoryNotes?.slice(0, 6).map(n => (
                      <div className="item" key={n._id}>
                        {n.content.slice(0, 120) || <em style={{ color: "var(--text-faint)" }}>empty</em>}
                        <span className="ts">memory · {n.section}</span>
                      </div>
                    ))}
                  </div>
                  <div className="rail-section">
                    <h4>Recent decisions</h4>
                    {(!recentDecisions || recentDecisions.length === 0) && (
                      <div className="item" style={{ color: "var(--text-faint)" }}>None yet.</div>
                    )}
                    {recentDecisions?.slice(0, 5).map(d => (
                      <div className="item" key={d._id}>
                        {d.title}
                        <span className="ts">{d.decisionId} · {new Date(d.createdAt).toISOString().slice(0, 10)}</span>
                      </div>
                    ))}
                  </div>
                </>
              )}
              {railTab === "threads" && (
                <div className="rail-section">
                  <h4>Sessions</h4>
                  {(!threads || threads.length === 0) && (
                    <div className="item" style={{ color: "var(--text-faint)" }}>No sessions yet.</div>
                  )}
                  {threads?.map(t => (
                    <div
                      key={t._id}
                      className="item"
                      onClick={() => onSelectThread(t._id)}
                      style={{
                        cursor: "pointer",
                        background: threadId === t._id ? "var(--bg-elev)" : undefined,
                      }}
                    >
                      {t.title}
                      <span className="ts">{new Date(t.lastMessageAt ?? t.createdAt).toISOString().slice(0, 10)}</span>
                    </div>
                  ))}
                </div>
              )}
              {railTab === "sources" && (
                <div className="rail-section">
                  <h4>Ingested docs</h4>
                  {(!recentDocs || recentDocs.length === 0) && (
                    <div className="item" style={{ color: "var(--text-faint)" }}>
                      Upload some files in the Docs tab.
                    </div>
                  )}
                  {recentDocs?.map(d => (
                    <div className="item" key={d._id}>
                      <code>{d.name}</code>
                      <span className="ts">
                        {d.status} · {d.chunkCount ?? 0} chunk{d.chunkCount === 1 ? "" : "s"}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </aside>
        )}
      </div>
    </>
  );
}
