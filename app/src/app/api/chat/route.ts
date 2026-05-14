import type { NextRequest } from "next/server";
import { MODELS, resolveModel, type ModelKey } from "@/lib/models";

export const runtime = "edge";

type ChatMessage = {
  role: "system" | "user" | "assistant";
  content: string;
};

type ChatRequest = {
  messages: ChatMessage[];
  model?: ModelKey;
  stream?: boolean;
};

export async function POST(req: NextRequest) {
  const apiKey = process.env.OPENROUTER_API_KEY;
  if (!apiKey) {
    return Response.json(
      { error: "OPENROUTER_API_KEY is not set. Add it to app/.env.local." },
      { status: 500 },
    );
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
  const stream = body.stream !== false;

  const upstream = await fetch("https://openrouter.ai/api/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
      "HTTP-Referer": process.env.OPENROUTER_SITE_URL ?? "http://localhost:3000",
      "X-Title": process.env.OPENROUTER_APP_NAME ?? "Y2 PMS",
    },
    body: JSON.stringify({
      model: modelId,
      messages: body.messages,
      stream,
    }),
  });

  if (!upstream.ok) {
    const text = await upstream.text();
    return Response.json(
      { error: "OpenRouter request failed", status: upstream.status, detail: text },
      { status: 502 },
    );
  }

  if (!stream) {
    const data = await upstream.json();
    return Response.json(data);
  }

  return new Response(upstream.body, {
    headers: {
      "Content-Type": "text/event-stream; charset=utf-8",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
    },
  });
}

export async function GET() {
  return Response.json({ models: MODELS });
}
