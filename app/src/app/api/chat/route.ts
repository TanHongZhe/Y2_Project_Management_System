import type { NextRequest } from "next/server";
import { ConvexHttpClient } from "convex/browser";
import { api } from "../../../../convex/_generated/api";
import type { Id } from "../../../../convex/_generated/dataModel";
import { MODELS, resolveModel, type ModelKey } from "@/lib/models";

export const runtime = "edge";
export const dynamic = "force-dynamic";

type ChatContent =
  | string
  | Array<
      | { type: "text"; text: string }
      | { type: "image_url"; image_url: { url: string } }
    >;

type ChatMessage = {
  role: "user" | "assistant" | "system";
  content: ChatContent;
};

function asText(content: ChatContent): string {
  if (typeof content === "string") return content;
  return content
    .filter((p): p is { type: "text"; text: string } => p.type === "text")
    .map(p => p.text)
    .join(" ");
}

type ChatRequest = {
  messages: ChatMessage[];
  model?: ModelKey;
  threadId?: string;
  saveThread?: boolean;
  temperature?: number;
  maxTokens?: number;
};

type ToolName =
  | "log_decision"
  | "add_component"
  | "update_memory"
  | "log_test_result";

type ToolDefinition = {
  type: "function";
  function: {
    name: ToolName;
    description: string;
    parameters: Record<string, unknown>;
  };
};

const TOOLS: ToolDefinition[] = [
  {
    type: "function",
    function: {
      name: "log_decision",
      description:
        "Append a decision to the project decision log. Use when the user confirms a design choice or you want to formalise a trade-off.",
      parameters: {
        type: "object",
        properties: {
          title: { type: "string", description: "One-line decision title" },
          rationale: {
            type: "string",
            description: "Why this was chosen, including any trade-offs",
          },
          tags: {
            type: "array",
            items: { type: "string" },
            description:
              "Topic tags like arch / bus / pv / bom / cost / firmware",
          },
        },
        required: ["title", "rationale"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "add_component",
      description:
        "Add a part to the Bill of Materials. Use when the user wants to order or plan a new component.",
      parameters: {
        type: "object",
        properties: {
          name: { type: "string", description: "Human-readable part name" },
          qty: { type: "number", description: "Quantity to procure" },
          unit: { type: "string", description: "Unit (pcs, m, kit...)" },
          estCost: {
            type: "number",
            description: "Estimated cost per unit, in GBP. Copy the exact decimal value from the user's message — do not transpose or round digits (e.g. £4.20 → 4.20, not 4.02).",
          },
          supplier: { type: "string", description: "Supplier name" },
          model: { type: "string", description: "Vendor part number / model" },
          specs: { type: "string", description: "Brief key specs" },
          status: {
            type: "string",
            enum: ["planned", "ordered", "received", "installed"],
          },
          tags: { type: "array", items: { type: "string" } },
        },
        required: ["name", "qty", "estCost"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "update_memory",
      description:
        "Upsert a section of project memory. Use sparingly — only when the user shares an enduring fact or constraint.",
      parameters: {
        type: "object",
        properties: {
          section: {
            type: "string",
            description: "Section title to upsert (e.g. 'Bus Voltage').",
          },
          content: {
            type: "string",
            description: "Full markdown body for the section.",
          },
        },
        required: ["section", "content"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "log_test_result",
      description:
        "Record a test result with metrics in the test log. Use when the user reports a measurement.",
      parameters: {
        type: "object",
        properties: {
          title: { type: "string" },
          subsystem: {
            type: "string",
            description: "Subsystem id: pv / supercap / bus / led / comms / system",
          },
          result: {
            type: "string",
            enum: ["pass", "fail", "pending"],
          },
          metrics: {
            type: "array",
            items: {
              type: "object",
              properties: {
                key: { type: "string" },
                value: { type: "string" },
                unit: { type: "string" },
              },
              required: ["key", "value"],
            },
          },
          conditions: { type: "string" },
          notes: { type: "string" },
        },
        required: ["title", "subsystem"],
      },
    },
  },
];

const SYSTEM_PROMPT = `You are the project copilot for the Y2 Solar Bus Demonstrator — a small hardware project. Be concise, engineering-accurate, and grounded in retrieved context.

Rules:
- Treat retrieved context (chunks, memory notes, decisions) as ground truth. Cite filenames when you quote specific numbers.
- When the user reports a decision, measurement, new part, or enduring constraint, call the matching tool to record it. Do not invent confirmation: only call tools when the user clearly intends to log something.
- Prefer tool calls over verbose prose when the user asks you to "log", "record", "add", "save", or "remember".
- When calling tools, copy numeric values (prices, quantities, measurements) exactly as stated by the user — never transpose digits (e.g. £4.20 must be passed as 4.20, not 4.02).
- If a question cannot be answered from retrieved context, say so plainly instead of guessing.
- Markdown is fine. Keep code blocks short.`;

function getConvex(): ConvexHttpClient | null {
  const url = process.env.NEXT_PUBLIC_CONVEX_URL;
  if (!url) return null;
  return new ConvexHttpClient(url);
}

function escapeRecord(s: string): string {
  return s.replace(/```/g, "ʼʼʼ").trim();
}

async function buildContext(
  convex: ConvexHttpClient,
  userQuery: string,
): Promise<{
  textBlock: string;
  imageRefs: Array<{ url: string; description: string; documentName: string }>;
  citations: Array<{ file: string; section?: string; url?: string; score?: number; sent?: boolean }>;
}> {
  const ragPromise = convex.action(api.rag.search, {
    query: userQuery,
    limit: 16,
  });
  const memoryPromise = convex.query(api.memoryNotes.list, {});
  const decisionsPromise = convex.query(api.decisions.list, { limit: 5 });

  const [rag, memoryNotes, decisions] = await Promise.all([
    ragPromise.catch(() => ({ textChunks: [], imageChunks: [], allCandidates: [] })),
    memoryPromise.catch(() => []),
    decisionsPromise.catch(() => []),
  ]);

  const citations: Array<{ file: string; section?: string; url?: string; score?: number; sent?: boolean }> = [];
  const parts: string[] = [];

  if (memoryNotes.length > 0) {
    parts.push("=== PINNED PROJECT MEMORY ===");
    for (const n of memoryNotes) {
      parts.push(`## ${n.section}\n${escapeRecord(n.content)}`);
    }
  }

  if (decisions.length > 0) {
    parts.push("\n=== RECENT DECISIONS ===");
    for (const d of decisions) {
      parts.push(
        `- ${d.decisionId} ${new Date(d.createdAt).toISOString().slice(0, 10)} — ${d.title}\n  why: ${d.rationale}`,
      );
    }
  }

  if (rag.textChunks.length > 0) {
    parts.push("\n=== RETRIEVED CHUNKS ===");
    for (const c of rag.textChunks) {
      const heading = c.heading ? ` · ${c.heading}` : "";
      parts.push(`[${c.documentName}${heading}]\n${escapeRecord(c.text)}`);
    }
  }

  if (rag.imageChunks.length > 0) {
    parts.push("\n=== RETRIEVED IMAGES ===");
    for (const c of rag.imageChunks) {
      parts.push(`[${c.documentName}] ${c.description}`);
    }
  }

  // Debug citations: all vector candidates with scores and sent status
  for (const c of (rag.allCandidates ?? [])) {
    citations.push({ file: c.documentName, section: c.heading, score: c.score, sent: c.sent });
  }

  return {
    textBlock: parts.join("\n\n"),
    imageRefs: rag.imageChunks.map((c) => ({
      url: c.url,
      description: c.description,
      documentName: c.documentName,
    })),
    citations,
  };
}

async function dispatchToolCall(
  convex: ConvexHttpClient,
  name: string,
  rawArgs: string,
): Promise<{ ok: true; result: string } | { ok: false; error: string }> {
  let args: Record<string, unknown>;
  try {
    args = JSON.parse(rawArgs || "{}");
  } catch (err) {
    return { ok: false, error: `bad json: ${(err as Error).message}` };
  }

  try {
    if (name === "log_decision") {
      const res = await convex.mutation(api.decisions.create, {
        title: String(args.title ?? ""),
        rationale: String(args.rationale ?? ""),
        tags: Array.isArray(args.tags) ? (args.tags as string[]) : [],
      });
      return { ok: true, result: `Decision ${res.decisionId} logged.` };
    }
    if (name === "add_component") {
      const res = await convex.mutation(api.components.create, {
        name: String(args.name ?? ""),
        qty: Number(args.qty ?? 1),
        unit: args.unit ? String(args.unit) : undefined,
        estCost: Number(args.estCost ?? 0),
        status:
          args.status === "ordered" ||
          args.status === "received" ||
          args.status === "installed"
            ? args.status
            : "planned",
        supplier: args.supplier ? String(args.supplier) : undefined,
        model: args.model ? String(args.model) : undefined,
        specs: args.specs ? String(args.specs) : undefined,
        tags: Array.isArray(args.tags) ? (args.tags as string[]) : [],
      });
      return { ok: true, result: `Component ${res.ref} added.` };
    }
    if (name === "update_memory") {
      await convex.mutation(api.memoryNotes.upsert, {
        section: String(args.section ?? ""),
        content: String(args.content ?? ""),
        author: "ai",
      });
      return { ok: true, result: `Memory section "${args.section}" updated.` };
    }
    if (name === "log_test_result") {
      const metrics = Array.isArray(args.metrics)
        ? (args.metrics as Array<Record<string, unknown>>).map((m) => ({
            key: String(m.key ?? ""),
            value: String(m.value ?? ""),
            unit: m.unit ? String(m.unit) : undefined,
          }))
        : [];
      const res = await convex.mutation(api.tests.create, {
        title: String(args.title ?? ""),
        subsystem: String(args.subsystem ?? "system"),
        result:
          args.result === "pass" || args.result === "fail" || args.result === "pending"
            ? args.result
            : "pending",
        metrics,
        conditions: args.conditions ? String(args.conditions) : undefined,
        notes: args.notes ? String(args.notes) : undefined,
        author: "ai",
      });
      return { ok: true, result: `Test ${res.testId} recorded.` };
    }
    return { ok: false, error: `unknown tool ${name}` };
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : String(err),
    };
  }
}

type OpenRouterStreamDelta = {
  content?: string;
  tool_calls?: Array<{
    index: number;
    id?: string;
    type?: "function";
    function?: { name?: string; arguments?: string };
  }>;
};

type StreamEvent =
  | { type: "content"; delta: string }
  | { type: "citations"; citations: Array<{ file: string; section?: string; url?: string; score?: number; sent?: boolean }> }
  | {
      type: "tool_call";
      id: string;
      name: string;
      args: string;
      status: "applied" | "error";
      result: string;
    }
  | { type: "error"; message: string }
  | { type: "done"; usage?: { prompt_tokens?: number; completion_tokens?: number; total_tokens?: number } | null };

function sse(event: StreamEvent): string {
  return `data: ${JSON.stringify(event)}\n\n`;
}

export async function POST(req: NextRequest) {
  const apiKey = process.env.OPENROUTER_API_KEY;
  if (!apiKey) {
    console.error("[chat] OPENROUTER_API_KEY is not set");
    return Response.json({ error: "Server configuration error" }, { status: 500 });
  }

  let body: ChatRequest;
  try {
    body = (await req.json()) as ChatRequest;
  } catch {
    return Response.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  if (!Array.isArray(body.messages) || body.messages.length === 0) {
    return Response.json({ error: "messages[] is required" }, { status: 400 });
  }

  const modelId = resolveModel(body.model);
  const isBoost = body.model === "boost";
  const temperature = isBoost
    ? Math.min(body.temperature ?? 0.3, 0.3)
    : Math.max(0, Math.min(1, body.temperature ?? 0.3));
  const maxTokens = Math.max(256, Math.min(16384, body.maxTokens ?? 4096));
  const convex = getConvex();

  const lastUser = [...body.messages].reverse().find((m) => m.role === "user");
  const userQuery = asText(lastUser?.content ?? "");

  let contextBlock = "";
  let citations: Array<{ file: string; section?: string; url?: string; score?: number; sent?: boolean }> = [];
  let imageRefs: Array<{
    url: string;
    description: string;
    documentName: string;
  }> = [];

  // Skip RAG for fully-specified action commands — all data is in the message itself.
  const isStructuredAction = /^(add|log|record|update|remove|delete)\s+a?\s*(component|part|decision|test|memory)/i.test(userQuery.trim());

  // Enrich the RAG query with the last assistant turn for follow-up question context.
  // userQuery (raw) is intentionally kept separate — isStructuredAction must use the raw user message.
  const lastAssistant = [...body.messages].reverse().find((m) => m.role === "assistant");
  const priorContext = lastAssistant ? asText(lastAssistant.content).slice(0, 400) : "";
  const ragQuery = priorContext
    ? `Prior context: ${priorContext}\n\nQuestion: ${userQuery}`
    : userQuery;

  if (convex && userQuery && !isStructuredAction) {
    try {
      const ctxBuilt = await buildContext(convex, ragQuery);
      contextBlock = ctxBuilt.textBlock;
      citations = ctxBuilt.citations;
      imageRefs = ctxBuilt.imageRefs;
    } catch (err) {
      console.error("context build failed", err);
    }
  }

  const history = body.messages.slice(-12);
  const lastIdx = history.length - 1;

  type UpstreamContent =
    | string
    | Array<
        | { type: "text"; text: string }
        | { type: "image_url"; image_url: { url: string } }
      >;

  const upstreamMessages: Array<{
    role: "system" | "user" | "assistant";
    content: UpstreamContent;
  }> = [];

  upstreamMessages.push({ role: "system", content: SYSTEM_PROMPT });

  if (contextBlock) {
    upstreamMessages.push({
      role: "system",
      content: `Retrieved project context (use as ground truth):\n\n${contextBlock}`,
    });
  }

  history.forEach((m, i) => {
    if (i === lastIdx && m.role === "user" && imageRefs.length > 0) {
      // Merge RAG image refs into the last user message
      const textPart = asText(m.content);
      const parts: Array<
        | { type: "text"; text: string }
        | { type: "image_url"; image_url: { url: string } }
      > = [{ type: "text", text: textPart }];
      // Preserve any user-attached images from the multimodal content
      if (Array.isArray(m.content)) {
        for (const p of m.content) {
          if (p.type === "image_url") parts.push(p);
        }
      }
      for (const ref of imageRefs.slice(0, 4)) {
        parts.push({ type: "image_url", image_url: { url: ref.url } });
      }
      upstreamMessages.push({ role: "user", content: parts });
    } else {
      upstreamMessages.push({ role: m.role, content: m.content });
    }
  });

  let threadId: Id<"threads"> | null = null;
  if (convex && body.saveThread !== false) {
    try {
      if (body.threadId) {
        threadId = body.threadId as Id<"threads">;
      } else {
        const newThread = await convex.mutation(api.threads.create, {
          title: userQuery.slice(0, 60) || "New session",
        });
        threadId = newThread as Id<"threads">;
      }
      if (threadId && lastUser) {
        await convex.mutation(api.messages.send, {
          threadId,
          role: "user",
          content: asText(lastUser.content),
        });
      }
    } catch (err) {
      console.error("thread save failed", err);
    }
  }

  const fallbackId = isBoost ? MODELS.flash.id : MODELS.boost.id;

  async function callOR(mid: string) {
    return fetch("https://openrouter.ai/api/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
        "HTTP-Referer": process.env.OPENROUTER_SITE_URL ?? "http://localhost:3000",
        "X-Title": process.env.OPENROUTER_APP_NAME ?? "Y2 PMS",
      },
      body: JSON.stringify({
        model: mid,
        messages: upstreamMessages,
        tools: TOOLS,
        tool_choice: "auto",
        stream: true,
        stream_options: { include_usage: true },
        temperature,
        max_tokens: maxTokens,
      }),
    });
  }

  let upstream = await callOR(modelId);
  let isFallback = false;

  if (!upstream.ok) {
    upstream = await callOR(modelId);
  }

  if (!upstream.ok) {
    upstream = await callOR(fallbackId);
    isFallback = upstream.ok;
  }

  if (!upstream.ok || !upstream.body) {
    const text = await upstream.text().catch(() => "");
    return Response.json(
      { error: "OpenRouter request failed", status: upstream.status, detail: text },
      { status: 502 },
    );
  }

  const encoder = new TextEncoder();
  const decoder = new TextDecoder();

  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      try {
        if (isFallback) {
          controller.enqueue(encoder.encode(sse({ type: "content", delta: `> ⚠️ \`${modelId}\` rate-limited — switched to \`${fallbackId}\`.\n\n` })));
        }
        if (citations.length > 0) {
          controller.enqueue(encoder.encode(sse({ type: "citations", citations })));
        }

        const reader = upstream.body!.getReader();
        let buffer = "";
        let assistantText = "";
        const pendingTools = new Map<
          number,
          { id: string; name: string; args: string }
        >();
        const executedTools: Array<{
          name: string;
          args: string;
          status: "applied" | "error";
          result: string;
        }> = [];

        const executedIds = new Set<string>();
        let usage: { prompt_tokens?: number; completion_tokens?: number; total_tokens?: number } | null = null;

        async function maybeExecute(index: number) {
          const t = pendingTools.get(index);
          if (!t || !t.name) return;
          if (executedIds.has(t.id || `idx-${index}`)) return;
          try {
            JSON.parse(t.args || "{}");
          } catch {
            return;
          }
          executedIds.add(t.id || `idx-${index}`);
          if (!convex) {
            const ev: StreamEvent = {
              type: "tool_call",
              id: t.id || `idx-${index}`,
              name: t.name,
              args: t.args,
              status: "error",
              result: "Convex not configured",
            };
            controller.enqueue(encoder.encode(sse(ev)));
            executedTools.push({
              name: t.name,
              args: t.args,
              status: "error",
              result: "Convex not configured",
            });
            return;
          }
          const outcome = await dispatchToolCall(convex, t.name, t.args);
          const status: "applied" | "error" = outcome.ok ? "applied" : "error";
          const result = outcome.ok ? outcome.result : outcome.error;
          controller.enqueue(
            encoder.encode(
              sse({
                type: "tool_call",
                id: t.id || `idx-${index}`,
                name: t.name,
                args: t.args,
                status,
                result,
              }),
            ),
          );
          executedTools.push({ name: t.name, args: t.args, status, result });
        }

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
            if (!payload || payload === "[DONE]") continue;
            let json: {
              choices?: Array<{
                delta?: OpenRouterStreamDelta;
                finish_reason?: string | null;
              }>;
              usage?: { prompt_tokens?: number; completion_tokens?: number; total_tokens?: number };
            };
            try {
              json = JSON.parse(payload);
            } catch {
              continue;
            }
            if (json.usage) usage = json.usage;
            const delta = json.choices?.[0]?.delta;
            if (!delta) continue;

            if (typeof delta.content === "string" && delta.content.length > 0) {
              assistantText += delta.content;
              controller.enqueue(
                encoder.encode(sse({ type: "content", delta: delta.content })),
              );
            }

            if (Array.isArray(delta.tool_calls)) {
              for (const tc of delta.tool_calls) {
                const idx = tc.index ?? 0;
                const cur = pendingTools.get(idx) ?? { id: "", name: "", args: "" };
                if (tc.id) cur.id = tc.id;
                if (tc.function?.name) cur.name = tc.function.name;
                if (tc.function?.arguments) cur.args += tc.function.arguments;
                pendingTools.set(idx, cur);
              }
            }

            const finishReason = json.choices?.[0]?.finish_reason;
            if (finishReason === "tool_calls") {
              for (const idx of pendingTools.keys()) {
                await maybeExecute(idx);
              }
            }
          }
        }

        for (const idx of pendingTools.keys()) {
          await maybeExecute(idx);
        }

        if (threadId && convex) {
          try {
            await convex.mutation(api.messages.send, {
              threadId,
              role: "assistant",
              content: assistantText,
              model: modelId,
              toolCalls: executedTools.length
                ? executedTools.map((t) => ({
                    name: t.name,
                    args: t.args,
                    status: t.status,
                    result: t.result,
                  }))
                : undefined,
              citations: citations.length ? citations : undefined,
            });
          } catch (err) {
            console.error("save assistant message failed", err);
          }
        }

        controller.enqueue(encoder.encode(sse({ type: "done", usage })));
        controller.close();
      } catch (err) {
        console.error("[chat/stream]", err);
        const message = err instanceof Error ? err.message : String(err);
        controller.enqueue(encoder.encode(sse({ type: "error", message })));
        controller.enqueue(encoder.encode(sse({ type: "done", usage: null })));
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream; charset=utf-8",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
      "X-Thread-Id": threadId ? String(threadId) : "",
    },
  });
}

export async function GET() {
  return Response.json({ models: MODELS });
}
