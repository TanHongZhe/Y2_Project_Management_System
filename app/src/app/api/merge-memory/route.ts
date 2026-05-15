import type { NextRequest } from "next/server";

export const runtime = "edge";
export const dynamic = "force-dynamic";

interface MemoryNote {
  section: string;
  content: string;
}

interface MergeRequest {
  meetingTitle: string;
  meetingContent: string;
  existingMemory: MemoryNote[];
}

const LOCKED_SECTIONS = [
  "project brief",
  "course requirements",
  "assessment criteria",
  "module descriptor",
  "brief",
];

function isLocked(section: string): boolean {
  const lower = section.toLowerCase();
  return LOCKED_SECTIONS.some((s) => lower.includes(s));
}

export async function POST(req: NextRequest) {
  const apiKey = process.env.OPENROUTER_API_KEY;
  if (!apiKey) {
    return Response.json({ error: "Server configuration error" }, { status: 500 });
  }

  let body: MergeRequest;
  try {
    body = (await req.json()) as MergeRequest;
  } catch {
    return Response.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const { meetingTitle, meetingContent, existingMemory } = body;
  if (!meetingContent?.trim()) {
    return Response.json({ updates: [] });
  }

  const lockedList = existingMemory
    .filter((n) => isLocked(n.section))
    .map((n) => `"${n.section}"`)
    .join(", ");

  const memoryStr = existingMemory
    .map((n) => `[SECTION: ${n.section}]\n${n.content}`)
    .join("\n\n");

  const sectionNames = existingMemory.map((n) => `"${n.section}"`).join(", ");

  const prompt = `You are the living memory for a university engineering project called "Solar Bus Demonstrator" (ENG2-SYS). Your job is to extract EVERY piece of meaningful information from the meeting notes and store it in the right section.

CURRENT PROJECT MEMORY (each section is labelled [SECTION: <name>]):
${memoryStr || "(empty — no sections yet)"}

NEW MEETING NOTES — ${meetingTitle}:
${meetingContent}

Your task:
1. Go through every fact, decision, assignment, and update in the meeting notes.
2. For each piece of information, find the best matching existing section and update it, OR create a new section with a clear short name.
3. Write content as clean, current-state facts. Do NOT include historical notes like "(changed from X)" — just state what is true now.
4. Be comprehensive — if the meeting mentions team roles, decisions, technical specs, upcoming actions, etc., each deserves its own section or an update to an existing one.
5. Suggested section names if they don't exist: "Team Assignments", "Decisions", "Action Items", "Technical Specs", "Upcoming Meetings", "Risk Register" — use these if relevant.

Hard rules:
- NEVER modify or rename these locked sections: ${lockedList || "(none)"}.
- Use the EXACT section name from [SECTION: ...] when updating existing sections — do NOT add #, ##, or ### characters.
- Existing section names: ${sectionNames || "(none yet)"}.
- When a value changes (e.g. voltage 14V → 12V), overwrite with the new value only.
- Return ONLY a valid JSON array: [{ "section": string, "content": string }, ...]
- If truly nothing meaningful was said, return [].
- No markdown code fences, no explanation — raw JSON array only.`;

  const orHeaders = {
    "Content-Type": "application/json",
    Authorization: `Bearer ${apiKey}`,
    "HTTP-Referer": process.env.OPENROUTER_SITE_URL ?? "http://localhost:3001",
    "X-Title": "Y2 PMS",
  };
  const orBody = (model: string) =>
    JSON.stringify({ model, messages: [{ role: "user", content: prompt }], temperature: 0.1, max_tokens: 2048 });

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
    return Response.json({ error: "AI request failed", detail: String(e) }, { status: 502 });
  }

  if (!upstream.ok) {
    const detail = await upstream.text().catch(() => "");
    return Response.json({ error: "AI request failed", detail }, { status: 502 });
  }

  const data = (await upstream.json()) as {
    choices: Array<{ message: { content: string } }>;
  };

  const raw = data.choices?.[0]?.message?.content ?? "";
  const cleaned = raw.replace(/```json\s*/gi, "").replace(/```\s*/g, "").trim();

  let updates: MemoryNote[];
  try {
    updates = JSON.parse(cleaned) as MemoryNote[];
    if (!Array.isArray(updates)) updates = [];
  } catch {
    return Response.json({ error: "Failed to parse AI response", raw }, { status: 500 });
  }

  // Strip any leading markdown heading markers the model incorrectly added to section names
  updates = updates.map((u) => ({
    ...u,
    section: u.section.replace(/^#+\s*/, "").trim(),
  }));

  // Snap section name to the closest existing section (case-insensitive match) to avoid duplicates
  const existingNames = existingMemory.map((n) => n.section);
  updates = updates.map((u) => {
    const match = existingNames.find(
      (n) => n.toLowerCase() === u.section.toLowerCase()
    );
    return match ? { ...u, section: match } : u;
  });

  // Strip any locked sections the model tried to update anyway
  updates = updates.filter((u) => !isLocked(u.section));

  return Response.json({ updates });
}
