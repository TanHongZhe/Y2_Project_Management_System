import { NextRequest } from "next/server";
import { ConvexHttpClient } from "convex/browser";
import { api } from "../../../../convex/_generated/api";
import { Id } from "../../../../convex/_generated/dataModel";

export async function POST(req: NextRequest) {
  const apiKey = process.env.OPENROUTER_API_KEY;
  const convexUrl = process.env.NEXT_PUBLIC_CONVEX_URL;

  let body: { message: string; threadId: string };
  try {
    body = (await req.json()) as { message: string; threadId: string };
  } catch {
    return Response.json({ ok: false });
  }

  if (!apiKey || !body.message) return Response.json({ ok: false });

  try {
    const res = await fetch("https://openrouter.ai/api/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "openai/gpt-5.4-nano",
        messages: [
          {
            role: "user",
            content: `Give this conversation a short title (3–5 words). Reply with ONLY the title — no quotes, no punctuation, no explanation.\n\nFirst message: ${body.message.slice(0, 300)}`,
          },
        ],
        max_tokens: 20,
      }),
    });

    if (!res.ok) return Response.json({ ok: false });

    const data = (await res.json()) as {
      choices?: Array<{ message?: { content?: string } }>;
    };
    const title = data.choices?.[0]?.message?.content?.trim() ?? "";

    if (title && convexUrl && body.threadId) {
      const convex = new ConvexHttpClient(convexUrl);
      await convex.mutation(api.threads.setTitle, {
        threadId: body.threadId as Id<"threads">,
        title,
      });
    }

    return Response.json({ ok: true, title });
  } catch {
    return Response.json({ ok: false });
  }
}
