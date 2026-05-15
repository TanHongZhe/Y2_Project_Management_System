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

  const prompt = `You are a transcript polisher for a university engineering project called "Solar Bus Demonstrator" (ENG2-SYS).

Team members: ${teamNames}
${attendeesLine}
${contextSection}
Your tasks:
1. Remove all filler sounds and words: "uh", "uhh", "um", "umm", "ah", "ahh", "ehh", "err", "hmm", "like" (when used as filler), "you know", "so basically", "kind of" (when filler), etc.
2. Fix likely transcription errors using the team names and project context above. Example: "bong zoo" → "Hong Zhe", "jule dinny" → "Dzuldiniy", "chun wen" may be transcribed as "chun one" or "chin when", etc.
3. Clean up grammar and break run-on sentences for readability.
4. Lightly compress — remove pure repetition — but do NOT summarise or drop meaningful content. If someone says something twice accidentally, keep it once.
5. Return ONLY the cleaned transcript text. No explanation, no labels, no markdown.

RAW TRANSCRIPT:
${transcript}`;

  const orHeaders = {
    "Content-Type": "application/json",
    Authorization: `Bearer ${apiKey}`,
    "HTTP-Referer": process.env.OPENROUTER_SITE_URL ?? "http://localhost:3001",
    "X-Title": "Y2 PMS",
  };
  const orBody = (model: string) =>
    JSON.stringify({ model, messages: [{ role: "user", content: prompt }], temperature: 0.2, max_tokens: 1024 });

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
