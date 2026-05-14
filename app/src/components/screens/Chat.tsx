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
  citations: Array<{ file: string; section?: string; url?: string }>;
  toolCalls: StreamingTool[];
}

function MessageBubble({
  role,
  content,
  model,
  toolCalls,
  citations,
  streaming,
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
  citations?: Array<{ file: string; section?: string; url?: string }>;
  streaming?: boolean;
}) {
  const isUser = role === "user";
  return (
    <div className="msg-row">
      <div className={"msg-avatar " + (isUser ? "user" : "ai")}>{isUser ? "ME" : "AI"}</div>
      <div className="msg-body">
        <div className="msg-meta">
          <span className="role">{isUser ? "You" : "Assistant"}</span>
          {model && <span className="model-tag">{model}</span>}
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
          <div className="citations">
            {citations.map((c, i) => (
              <span className="citation-chip" key={i} title={c.url ?? c.file}>
                <span className="num">{i + 1}</span>
                <span>{c.file}</span>
                {c.section && <span style={{ color: "var(--text-faint)" }}>· {c.section}</span>}
              </span>
            ))}
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

export default function Chat({ tweaks, setRoute: _setRoute }: ChatProps) {
  void _setRoute;
  const threads = useQuery(api.threads.list, { limit: 30 });
  const createThread = useMutation(api.threads.create);
  const removeThread = useMutation(api.threads.remove);

  const [selectedThreadId, setSelectedThreadId] = useState<Id<"threads"> | null>(null);
  const threadId = selectedThreadId ?? threads?.[0]?._id ?? null;

  const messages = useQuery(api.messages.listByThread, threadId ? { threadId } : "skip");

  const [boost, setBoost] = useState(false);
  const [showDebug, setShowDebug] = useState(false);
  const [railTab, setRailTab] = useState("memory");
  const [draft, setDraft] = useState("");
  const [streaming, setStreaming] = useState(false);
  const [pending, setPending] = useState<PendingAssistant | null>(null);
  const taRef = useRef<HTMLTextAreaElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  const memoryNotes = useQuery(api.memoryNotes.list, {});
  const recentDecisions = useQuery(api.decisions.list, { limit: 5 });
  const recentDocs = useQuery(api.documents.list, { limit: 8 });

  async function newThread() {
    const id = await createThread({ title: "New session" });
    setSelectedThreadId(id as Id<"threads">);
    setPending(null);
  }

  async function deleteCurrent() {
    if (!threadId) return;
    await removeThread({ threadId });
    setSelectedThreadId(null);
    setPending(null);
  }

  async function handleSend() {
    const userText = draft.trim();
    if (!userText || streaming) return;
    setDraft("");
    if (taRef.current) taRef.current.style.height = "auto";

    let activeThreadId = threadId;
    if (!activeThreadId) {
      activeThreadId = (await createThread({ title: userText.slice(0, 60) })) as Id<"threads">;
      setSelectedThreadId(activeThreadId);
    }

    setStreaming(true);
    setPending({ content: "", citations: [], toolCalls: [] });

    const apiMessages: Array<{ role: "user" | "assistant" | "system"; content: string }> = (messages ?? []).map((m) => ({
      role: m.role,
      content: m.content,
    }));
    apiMessages.push({ role: "user", content: userText });

    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          model: boost ? "boost" : "flash",
          threadId: activeThreadId,
          messages: apiMessages,
        }),
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
            const citations = obj.citations as Array<{ file: string; section?: string; url?: string }>;
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
          } else if (type === "done") {
            // server has saved assistant message; clear local pending on next tick once Convex query refreshes
          }
        }
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Network error";
      setPending(prev => prev ? { ...prev, content: prev.content + `\n\n⚠️ ${msg}` } : { content: `⚠️ ${msg}`, citations: [], toolCalls: [] });
    } finally {
      setStreaming(false);
      setTimeout(() => setPending(null), 600);
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
                />
              )}
            </div>
          </div>

          <div className="composer-wrap">
            <div className="composer">
              <textarea
                ref={taRef}
                placeholder="Ask about the project, or describe a decision to log…"
                value={draft}
                onChange={onInput}
                onKeyDown={onKey}
              />
              <div className="composer-bar">
                <div className="left">
                  <div className="model-picker">
                    <button className={!boost ? "active" : ""} onClick={() => setBoost(false)} title={MODELS.flash.id}>
                      <span>{MODELS.flash.label}</span><span className="price">{MODELS.flash.id.split("/")[1]?.slice(0, 10) ?? ""}</span>
                    </button>
                    <button className={"boost " + (boost ? "active" : "")} onClick={() => setBoost(true)} title={MODELS.boost.id}>
                      <Icons.Bolt size={11} /><span>{MODELS.boost.label}</span><span className="price">{MODELS.boost.id.split("/")[1]?.slice(0, 10) ?? ""}</span>
                    </button>
                  </div>
                </div>
                <div className="right">
                  <span className="hint"><span className="kbd">⏎</span> send · <span className="kbd">⇧⏎</span> newline</span>
                  <button className="btn primary sm" onClick={() => void handleSend()} disabled={!draft.trim() || streaming}>
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
                      onClick={() => setSelectedThreadId(t._id)}
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
