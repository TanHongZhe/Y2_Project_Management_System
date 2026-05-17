import type { NextRequest } from "next/server";

export const runtime = "edge";
export const dynamic = "force-dynamic";

interface PolishRequest {
  transcript: string;
  attendees?: string[];
  projectContext?: string;
}

export async function POST(req: NextRequest) {
  const apiKey = process.env.OPENROUTER_API_KEY;
  if (!apiKey) {
    return Response.json({ error: "Server configuration error" }, { status: 500 });
  }

  let body: PolishRequest;
  try {
    body = (await req.json()) as PolishRequest;
  } catch {
    return Response.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const { transcript, attendees = [], projectContext } = body;
  if (!transcript?.trim()) {
    return Response.json({ polished: "" });
  }

  const teamNames = [
    "Hong Zhe (HZ)",
    "Dzuldiniy (DZ)",
    "Chun Wen (CW)",
    "Wei Zen (WZ)",
    "Yong Zhi (YZ)",
    "Fangnan (FN)",
    "Yida (YD)",
  ].join(", ");

  const attendeesLine = attendees.length > 0
    ? `Meeting attendees: ${attendees.join(", ")}`
    : "";

  const contextSection = projectContext?.trim()
    ? `\nProject context:\n${projectContext.trim()}\n`
    : "";

  const prompt = `You are a meeting minutes writer for a university engineering project called "Smart Grid System" (ELEC50015).

Team members: ${teamNames}
${attendeesLine}
${contextSection}
Transform the raw transcript into professional meeting minutes formatted in Markdown. Follow this structure — skip any section that has no relevant content:

## Meeting Minutes

**Attendees:** [names from the attendees list above, or those mentioned in the transcript]

### Discussion
- [Key topic or point raised]
- [Another topic or point]

### Decisions
- [Concrete decision made during the meeting]

### Action Items
- [Task description] ([Owner name or initials if identifiable])

### Next Steps
- [What needs to happen before the next meeting]

Rules:
1. Remove all filler words: "uh", "um", "ah", "like" (when filler), "you know", "so basically", "kind of" (when filler), etc.
2. Fix transcription errors using team names: ${teamNames}. Example: "bong zoo" → "Hong Zhe", "jule dinny" → "Dzuldiniy", "chin when" → "Chun Wen".
3. Convert run-on speech into clear, concise bullet points. Preserve all meaningful content.
4. Do NOT summarise — if someone said something important, capture it.
5. Return ONLY the formatted Markdown meeting minutes. No explanation, no preamble.

RAW TRANSCRIPT:
${transcript}`;

  const orHeaders = {
    "Content-Type": "application/json",
    Authorization: `Bearer ${apiKey}`,
    "HTTP-Referer": process.env.OPENROUTER_SITE_URL ?? "http://localhost:3001",
    "X-Title": "Y2 PMS",
  };
  const orBody = (model: string) =>
    JSON.stringify({ model, messages: [{ role: "user", content: prompt }], temperature: 0.2, max_tokens: 16000 });

  let upstream: Response;
  try {
    upstream = await fetch("https://openrouter.ai/api/v1/chat/completions", {
      method: "POST", headers: orHeaders, body: orBody("openai/gpt-5.4-nano"),
    });
    if (!upstream.ok) {
      upstream = await fetch("https://openrouter.ai/api/v1/chat/completions", {
        method: "POST", headers: orHeaders, body: orBody("google/gemini-3.1-flash-lite"),
      });
    }
  } catch (e) {
    // If AI fails, fall back to raw transcript so recording isn't lost
    return Response.json({ polished: transcript, warning: String(e) });
  }

  if (!upstream.ok) {
    return Response.json({ polished: transcript, warning: `AI returned ${upstream.status}` });
  }

  const data = (await upstream.json()) as {
    choices: Array<{ message: { content: string } }>;
  };

  const polished = data.choices?.[0]?.message?.content?.trim() ?? transcript;
  return Response.json({ polished });
}
