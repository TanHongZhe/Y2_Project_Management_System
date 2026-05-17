import { v } from "convex/values";
import { internalAction, internalMutation } from "./_generated/server";
import { internal } from "./_generated/api";
import { Id } from "./_generated/dataModel";

// ── Flavour text ─────────────────────────────────────────────────────────────

const THINKING_LINES = [
  "Oki! On it rn 🔍",
  "Say less, gimme a sec ⚡",
  "On it~ brb 👀",
  "Oki let me cook 🍳",
  "On it! Won't take long 🔧",
  "Mm, give me a moment 🤔",
  "Right, on it 💨",
  "Got it, digging in 🔎",
  "Noted! Working on it now ✏️",
  "Gotcha, hold on ⏳",
  "One sec 👌",
  "On the case 🕵️",
];

const DOCS_THINKING_LINES = [
  "Reading the docs rn, hold tight 📚",
  "Skimming the knowledge base real quick 📖",
  "Checking the project docs… 🗂️",
  "Digging through the notes for this 🔍",
  "Pulling up relevant context… 📋",
  "Let me scan what we've got on file 🗃️",
  "Consulting the archives 🏛️",
  "Rifling through the docs brb 📂",
];

const DONE_FNS = [
  (n: number) => `Done! 🎉 Pulled from ${n} source${n !== 1 ? "s" : ""}. Check it out →`,
  (n: number) => `Here you go! 📝 Based on ${n} doc${n !== 1 ? "s" : ""} I found →`,
  (_n: number) => `Finished~ hope this helps! ✨ →`,
  (n: number) => `All done! Peeked at ${n} source${n !== 1 ? "s" : ""} for you 👀 →`,
  (_n: number) => `Boom, note created 💥 →`,
  (_n: number) => `There you go! Let me know if you need more 🙌 →`,
  (n: number) => `Done! Grabbed from ${n} doc${n !== 1 ? "s" : ""} 📄 →`,
];

const DONE_APPEND_FNS = [
  () => `Done! Appended to your note ✏️ →`,
  () => `Added it in! Check the note 📝 →`,
  () => `Appended~ take a look 👀 →`,
  () => `Done, note updated! 🎉 →`,
];

const DONE_REFINE_FNS = [
  () => `Refined! Note's been updated ✨ →`,
  () => `Done, gave it a good polish 🪄 →`,
  () => `Rewrote it for you~ check it out 📝 →`,
  () => `Note updated! Hope it reads better now 👌 →`,
];

const NO_CONTEXT_LINES = [
  "Hmm, couldn't find much in the docs for that one... gave it my best shot anyway 😅 →",
  "Not a lot to go on but I winged it 🤷 →",
  "Docs were kinda empty on this, improvised a lil 🙈 →",
  "Couldn't dig up much context but here's what I've got 🤔 →",
  "Thin on sources but I made do! 💪 →",
];

function pick<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// ── Models ───────────────────────────────────────────────────────────────────

const OR_BASE = "https://openrouter.ai/api/v1/chat/completions";

// Cheap/fast: routes yes/no on whether RAG is needed
const MODEL_ROUTER   = "mistralai/mistral-small-24b-instruct-2501";
const MODEL_ROUTER_FB = "openai/gpt-5.4-nano";

// Good: generates notes and chat replies
const MODEL_GOOD     = "xiaomi/mimo-v2.5";
const MODEL_GOOD_FB  = "anthropic/claude-sonnet-4.6";

// ── Prompts ──────────────────────────────────────────────────────────────────

const NOTE_SYSTEM = `You are Aria (AI Agent), embedded in the Smart Grid System Y2 project management system for a university engineering team. You're smart, helpful, and a little fun — not a stiff corporate bot. You're part of the team.

Your job: create a well-structured, thorough note based on the user's request and the context chunks provided.

Rules:
- Write in clean Markdown (headings, bullets, tables where useful)
- NEVER use LaTeX or dollar-sign math notation ($...$). Write all maths in plain text (e.g. E = ½CV², η = P_out / P_in, V = IR). Use Unicode superscripts/subscripts where helpful.
- Do NOT add preamble like "Sure! Here is your note:" — start directly with the title as an H1
- Be thorough but not padded — quality over length
- HARD LIMIT: keep the entire note under 1000 words. Prioritise the most useful content and finish every section you start — never end mid-sentence. If you sense you're running long, tighten earlier sections rather than truncating the end.
- If context is thin, say so briefly below the title and do your best
- At the very end, add a ## Sources section listing each document you drew from as a numbered list (e.g. "1. Document Name"). Do NOT cite inline — collect all citations at the bottom only.
- Project context: Smart Grid System, Spring 2026, budget £60, 7-person engineering team`;

const CHAT_SYSTEM = `You are Aria (AI Agent), a helpful AI teammate embedded in the Smart Grid System Y2 project management system. You're chatting directly with a team member in a chat app — be conversational, concise, and genuinely useful. No corporate stiffness.

STRICT FORMAT RULES:
- Plain text only — absolutely NO markdown (no ##, no **, no -, no tables, no LaTeX, no $...$)
- Maximum 2 short paragraphs. If you write 2, separate them with a blank line.
- No section titles or headers of any kind
- Write like a teammate texting, not an AI assistant writing a report

Project context: Smart Grid System, Spring 2026, budget £60, 7-person engineering team. If asked to create a note, remind them to @aria tag you.`;

const ROUTER_SYSTEM = `You are a routing assistant for an AI embedded in a university solar bus engineering project. Classify the user's message as exactly one of five actions.

CRITICAL DEFAULT: if the message is short, casual, a greeting, an acknowledgement, or you are not certain it needs documents — return "chat". Only return note/append/refine/search when the user is clearly asking for a document action or a specific factual project question.

- "note" — user wants a BRAND NEW document/note/summary/report created (e.g. "write me a note on...", "create a doc about...", "draft a report on...")
- "append" — user wants to ADD content to an existing note WITHOUT removing anything (e.g. "add a section on...", "also include...", "write about X below", "add an additional section...", "include more on...")
- "refine" — user wants to REWRITE or IMPROVE an existing note (e.g. "refine this", "rewrite it", "polish the whole thing", "clean it up", "restructure this")
- "search" — user asks a SPECIFIC factual question that requires looking up project documents to answer (e.g. "what are our battery test results?", "what supercapacitor should we use?", "what's the budget?", "what does our motor spec say?"). Must be a technical/factual question about the project.
- "chat" — DEFAULT for anything else: greetings ("hey", "hi", "thanks"), acknowledgements ("ok", "cool", "got it"), casual asks ("when is the meeting?", "what should I work on?", "who's free tomorrow?"), feelings/banter, or anything ambiguous.

Reply with ONLY one of those five words: note, append, refine, search, chat`;

const NOTE_INTENT_SYSTEM = `Classify how the user wants to modify an existing note:
- "append" — add a new section, bullet, or piece of information to the note (e.g. "@aria write...", "add a section on...", "also include...", "write about...")
- "refine" — rewrite, improve, or restructure the entire existing content (e.g. "refine this entire note", "rewrite this", "clean up the whole thing", "refine the existing content")
- "new" — create a completely separate new document (e.g. "create a new note about...", "write a new doc on...", "make a separate note")
Reply with ONLY one of: append, refine, new`;

const APPEND_SYSTEM = `You are Aria (AI Agent), adding a new section to an existing note in the Smart Grid System Y2 project management system.

Your job: generate a concise, well-structured section to append based on the user's request.

Rules:
- Write in clean Markdown
- NEVER use LaTeX or dollar-sign math notation. Write all maths in plain text.
- Start DIRECTLY with a ## heading for your new section — do NOT re-emit the original note or its title
- Be thorough but focused — only cover what was asked
- HARD LIMIT: keep the appended section under 600 words. Finish every paragraph and bullet — never cut off mid-sentence.
- At the very end, add a ## Sources section if you used documents
- Project context: Smart Grid System, Spring 2026, budget £60, 7-person engineering team`;

const REFINE_SYSTEM = `You are Aria (AI Agent), rewriting and refining an existing note in the Smart Grid System Y2 project management system.

Your job: rewrite the full note to be better — clearer, more complete, better structured — based on the user's instruction.

Rules:
- Write in clean Markdown (headings, bullets, tables where useful)
- NEVER use LaTeX or dollar-sign math notation. Write all maths in plain text.
- Start directly with the title as H1 (update it if you improve the framing)
- Maintain all accurate existing information, improve structure and clarity
- HARD LIMIT: keep the refined note under 1000 words. Tighten earlier sections rather than truncating the end — every section must finish cleanly.
- At the very end, add a ## Sources section listing source documents
- Project context: Smart Grid System, Spring 2026, budget £60, 7-person engineering team`;

// ── OpenRouter helper ─────────────────────────────────────────────────────────

type ORMsg = { role: string; content: string };

async function orCall(
  key: string,
  primary: string,
  fallback: string,
  messages: ORMsg[],
  maxTokens: number,
): Promise<string> {
  const headers = {
    "Content-Type": "application/json",
    Authorization: `Bearer ${key}`,
    "HTTP-Referer": "https://y2-pms.pages.dev",
    "X-Title": "Y2 PMS",
  };

  for (const model of [primary, fallback]) {
    try {
      const res = await fetch(OR_BASE, {
        method: "POST",
        headers,
        body: JSON.stringify({ model, messages, max_tokens: maxTokens }),
      });
      if (res.ok) {
        const data = (await res.json()) as { choices: Array<{ message: { content: string } }> };
        const text = data.choices[0]?.message?.content ?? "";
        if (text) return text;
      }
    } catch (err) {
      console.error(`aria: orCall ${model} failed`, err);
    }
  }
  return "";
}

// ── RAG helper ────────────────────────────────────────────────────────────────

type Chunk = { text: string; documentName: string; heading?: string };

async function embedText(openaiKey: string, text: string): Promise<number[] | null> {
  try {
    const res = await fetch("https://api.openai.com/v1/embeddings", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${openaiKey}` },
      body: JSON.stringify({ model: "text-embedding-3-small", input: text }),
    });
    if (!res.ok) return null;
    const data = (await res.json()) as { data: { embedding: number[] }[] };
    return data.data[0]?.embedding ?? null;
  } catch {
    return null;
  }
}

// ── Shared mutations ──────────────────────────────────────────────────────────

export const insertNote = internalMutation({
  args: {
    title: v.string(),
    content: v.string(),
    authorId: v.string(),
    sources: v.optional(v.array(v.string())),
  },
  handler: async (ctx, { title, content, authorId, sources }): Promise<Id<"meetingNotes">> => {
    return ctx.db.insert("meetingNotes", {
      title,
      content,
      date: Date.now(),
      attendees: [authorId],
      createdBy: "aria",
      updatedAt: Date.now(),
      source: "aria",
      sources,
    });
  },
});

// ── Utility ───────────────────────────────────────────────────────────────────

function extractTitle(message: string): string {
  const cleaned = message.replace(/@aria/gi, "").replace(/^[\s,\-:]+/, "").trim();
  const titled = cleaned.charAt(0).toUpperCase() + cleaned.slice(1);
  return titled.length > 80 ? titled.slice(0, 77) + "…" : titled || "Aria's Note";
}

// Locate the LAST "## Sources" heading in the content. Returns the index of the
// '#' character, or -1 if none. Using "last" guards against models that emit
// the heading mid-doc and again at the end.
function findSourcesHeading(content: string): number {
  const re = /^##\s+Sources\s*$/gim;
  let lastIdx = -1;
  let m: RegExpExecArray | null;
  while ((m = re.exec(content)) !== null) lastIdx = m.index;
  return lastIdx;
}

// Parses the "## Sources" section into a string array. Only captures lines up
// to the next ## heading (or end of doc), so unrelated trailing sections don't
// get parsed as sources.
function extractSources(content: string): string[] {
  const headingIdx = findSourcesHeading(content);
  if (headingIdx === -1) return [];
  const afterHeading = content.slice(headingIdx).replace(/^##\s+Sources\s*\n?/i, '');
  const stop = afterHeading.search(/\n##\s/);
  const block = stop === -1 ? afterHeading : afterHeading.slice(0, stop);
  return block
    .split('\n')
    .map((l) => l.replace(/^\d+\.\s*/, '').trim())
    .filter(Boolean);
}

// Removes only the "## Sources" section from content, preserving any sections
// that may follow it (in case the model didn't put Sources last).
function stripSources(content: string): string {
  const headingIdx = findSourcesHeading(content);
  if (headingIdx === -1) return content.trimEnd();
  const before = content.slice(0, headingIdx).trimEnd();
  const after = content.slice(headingIdx);
  const stop = after.search(/\n##\s/);
  if (stop === -1) return before;
  // Preserve whatever section follows Sources.
  const tail = after.slice(stop + 1);
  return (before + '\n\n' + tail).trimEnd();
}

// Fast pre-classification for obvious-chat messages: greetings, single-word
// replies, very short non-questions. Returns "chat" when we're confident, null
// otherwise (defer to the LLM router). The cheap router model sometimes
// misclassifies "hey" as "search" — pre-filtering saves the round-trip AND the
// spurious "Checking the project docs…" thinking message.
function preClassifyChat(message: string): "chat" | null {
  const raw = message.toLowerCase().replace(/[^\p{L}\p{N}\s'?!]/gu, '').trim();
  if (!raw) return "chat";

  const greetings = new Set([
    'hi', 'hey', 'hello', 'yo', 'sup', 'hola', 'heya', 'howdy',
    'thanks', 'thank you', 'thx', 'ty', 'cheers', 'tysm',
    'ok', 'okay', 'okie', 'kk', 'cool', 'nice', 'great', 'perfect',
    'awesome', 'sweet', 'gotcha', 'got it', 'noted', 'understood',
    'lol', 'lmao', 'haha', 'hehe', 'lmfao',
    'bye', 'goodbye', 'gn', 'gm', 'good night', 'good morning', 'good evening',
    'yes', 'no', 'yeah', 'nah', 'yep', 'nope', 'sure', 'maybe', 'idk',
    'wassup', "what's up", 'whats up',
  ]);
  if (greetings.has(raw)) return "chat";

  // Greeting + short addressee ("hey aria", "hi there", "thanks aria")
  if (/^(hi|hey|hello|yo|sup|thanks|thank you|thx|ty|cheers|good (morning|night|evening))\b/.test(raw)) {
    const words = raw.split(/\s+/);
    if (words.length <= 3 && !raw.includes('?')) return "chat";
  }

  // Single word with no question mark
  const words = raw.split(/\s+/);
  if (words.length === 1 && !raw.includes('?')) return "chat";

  return null;
}

// Extracts the first H1 heading from AI-generated markdown for use as the note title.
function extractNoteTitle(content: string): string {
  const match = content.match(/^#\s+(.+)$/m);
  if (match && match[1]) {
    const t = match[1].trim();
    return t.length > 80 ? t.slice(0, 77) + "…" : t;
  }
  return "";
}

function buildNotePrompt(userMessage: string, chunks: Chunk[]): string {
  const ctx =
    chunks.length > 0
      ? chunks
          .map(
            (c, i) =>
              `--- Source ${i + 1}: ${c.documentName}${c.heading ? ` > ${c.heading}` : ""} ---\n${c.text}`,
          )
          .join("\n\n")
      : "No relevant documents found in the knowledge base.";
  return `User request: ${userMessage}\n\n--- Project Knowledge Base ---\n${ctx}\n--- End Context ---\n\nWrite a comprehensive note based on the request above. Collect all source citations in a ## Sources section at the very end — do not cite inline.`;
}

// ── Main action ───────────────────────────────────────────────────────────────

export const handleMention = internalAction({
  args: {
    threadId: v.id("chatThreads"),
    authorId: v.string(),
    content: v.string(),
    mode: v.union(v.literal("rag_note"), v.literal("chat")),
    noteId: v.optional(v.id("meetingNotes")),
  },
  handler: async (ctx, { threadId, authorId, content, mode, noteId }) => {
    const orKey = process.env.OPENROUTER_API_KEY;
    const openaiKey = process.env.OPENAI_API_KEY;

    // ── Fetch history BEFORE adding any messages (keeps context clean) ───────
    const history =
      mode === "chat"
        ? ((await ctx.runQuery(internal.teamChat.recentMessages, {
            threadId,
            limit: 10,
          })) as Array<{ authorId: string; content: string }>)
        : [];

    // ── RAG helper (closure over ctx + openaiKey) ───────────────────────────
    async function doRag(): Promise<Chunk[]> {
      if (!openaiKey) return [];
      try {
        const vec = await embedText(openaiKey, content);
        if (!vec) return [];
        const hits = await ctx.vectorSearch("chunks", "by_embedding", { vector: vec, limit: 8 });
        if (!hits.length) return [];
        const docs = await ctx.runQuery(internal.chunks.getByIds, {
          ids: hits.map((h) => h._id),
        });
        return docs
          .filter((c) => c.sourceType === "text")
          .slice(0, 6)
          .map((c) => ({ text: c.text, documentName: c.documentName, heading: c.heading }));
      } catch (err) {
        console.error("aria: RAG failed", err);
        return [];
      }
    }

    // ════════════════════════════════════════════════════════════════════════
    // MODE: rag_note — @aria tag → RAG → create/append/refine note
    // ════════════════════════════════════════════════════════════════════════
    if (mode === "rag_note") {
      await ctx.runMutation(internal.teamChat.addAriaMessage, {
        threadId,
        content: pick(DOCS_THINKING_LINES),
      });

      // ── If a note context is provided, detect intent (append/refine/new) ──
      // When a note is attached and the router fails or is unavailable, default
      // to "append" — creating a duplicate new note silently is the worst UX.
      type NoteIntent = "append" | "refine" | "new";
      let intent: NoteIntent = noteId ? "append" : "new";

      if (noteId && orKey) {
        try {
          const raw = await orCall(
            orKey,
            MODEL_ROUTER,
            MODEL_ROUTER_FB,
            [
              { role: "system", content: NOTE_INTENT_SYSTEM },
              { role: "user", content },
            ],
            10,
          );
          const word = raw.toLowerCase().trim();
          if (word.startsWith("append")) intent = "append";
          else if (word.startsWith("refine")) intent = "refine";
          else intent = "new";
        } catch (err) {
          console.error("aria: intent detection failed", err);
        }
      }

      const chunks = await doRag();

      // ── APPEND path ────────────────────────────────────────────────────────
      if (intent === "append" && noteId) {
        let appendContent = "";
        if (orKey) {
          try {
            appendContent = await orCall(
              orKey,
              MODEL_GOOD,
              MODEL_GOOD_FB,
              [
                { role: "system", content: APPEND_SYSTEM },
                { role: "user", content: buildNotePrompt(content, chunks) },
              ],
              1600,
            );
          } catch (err) {
            console.error("aria: append generation failed", err);
          }
        }
        if (!appendContent) {
          appendContent = `## Aria's Addition\n\n*Aria couldn't generate content — API may be unavailable.*`;
        }
        const appendSources = extractSources(appendContent);
        await ctx.runMutation(internal.meetings.ariaAppend, {
          id: noteId,
          appendMd: stripSources(appendContent),
          newSources: appendSources.length > 0 ? appendSources : undefined,
        });
        await sleep(1000);
        await ctx.runMutation(internal.teamChat.addAriaMessage, {
          threadId,
          content: pick(DONE_APPEND_FNS)(),
          ariaTaskNoteId: noteId,
        });
        return;
      }

      // ── REFINE path ────────────────────────────────────────────────────────
      if (intent === "refine" && noteId) {
        const existingNote = await ctx.runQuery(internal.meetings.getByIdInternal, { id: noteId });
        let refinedContent = "";
        if (orKey && existingNote) {
          const refinePrompt = `User instruction: ${content}\n\n--- Existing Note ---\n${existingNote.content}\n--- End Note ---\n\n${buildNotePrompt(content, chunks)}`;
          try {
            refinedContent = await orCall(
              orKey,
              MODEL_GOOD,
              MODEL_GOOD_FB,
              [
                { role: "system", content: REFINE_SYSTEM },
                { role: "user", content: refinePrompt },
              ],
              2600,
            );
          } catch (err) {
            console.error("aria: refine generation failed", err);
          }
        }
        if (!refinedContent) {
          await sleep(1000);
          await ctx.runMutation(internal.teamChat.addAriaMessage, {
            threadId,
            content: "Hmm, I couldn't refine the note right now — API might be unavailable. Try again in a sec? 😅",
          });
          return;
        }
        const refineSources = extractSources(refinedContent);
        const refineTitle = extractNoteTitle(refinedContent);
        await ctx.runMutation(internal.meetings.ariaReplace, {
          id: noteId,
          content: stripSources(refinedContent),
          ...(refineTitle ? { title: refineTitle } : {}),
          newSources: refineSources.length > 0 ? refineSources : undefined,
        });
        await sleep(1000);
        await ctx.runMutation(internal.teamChat.addAriaMessage, {
          threadId,
          content: pick(DONE_REFINE_FNS)(),
          ariaTaskNoteId: noteId,
        });
        return;
      }

      // ── NEW note path (default) ────────────────────────────────────────────
      let noteContent = "";
      if (orKey) {
        try {
          noteContent = await orCall(
            orKey,
            MODEL_GOOD,
            MODEL_GOOD_FB,
            [
              { role: "system", content: NOTE_SYSTEM },
              { role: "user", content: buildNotePrompt(content, chunks) },
            ],
            2600,
          );
        } catch (err) {
          console.error("aria: note generation failed", err);
        }
      }

      if (!noteContent) {
        noteContent = `# ${extractTitle(content)}\n\n*Aria couldn't generate this note — API may be unavailable.*`;
      }

      const noteSources = extractSources(noteContent);
      const newNoteId = await ctx.runMutation(internal.aria.insertNote, {
        title: extractNoteTitle(noteContent) || extractTitle(content),
        content: stripSources(noteContent),
        authorId,
        sources: noteSources.length > 0 ? noteSources : undefined,
      });

      const doneLine =
        chunks.length > 0 ? pick(DONE_FNS)(chunks.length) : pick(NO_CONTEXT_LINES);

      await sleep(1000);
      await ctx.runMutation(internal.teamChat.addAriaMessage, {
        threadId,
        content: doneLine,
        ariaTaskNoteId: newNoteId,
      });

      return;
    }

    // ════════════════════════════════════════════════════════════════════════
    // MODE: chat — smart routing → conversational reply
    // ════════════════════════════════════════════════════════════════════════

    if (!orKey) {
      await ctx.runMutation(internal.teamChat.addAriaMessage, {
        threadId,
        content: "Sorry, I'm not set up properly right now 😅 Try again later!",
      });
      return;
    }

    // Step 1: cheap router → 5-way classification. Short-circuit obvious chat
    // (greetings, single-word replies) before paying for an LLM call.
    type Route = "note" | "append" | "refine" | "search" | "chat";
    let route: Route = "chat";
    const preroute = preClassifyChat(content);
    if (preroute) {
      route = preroute;
    } else {
      try {
        const raw = await orCall(
          orKey,
          MODEL_ROUTER,
          MODEL_ROUTER_FB,
          [
            { role: "system", content: ROUTER_SYSTEM },
            { role: "user", content },
          ],
          10,
        );
        const word = raw.toLowerCase().trim();
        if (word.startsWith("note")) route = "note";
        else if (word.startsWith("append")) route = "append";
        else if (word.startsWith("refine")) route = "refine";
        else if (word.startsWith("search") || word.startsWith("rag")) route = "search";
        else route = "chat";
      } catch (err) {
        console.error("aria: routing failed", err);
      }
    }

    // Step 2: thinking message for document-heavy paths
    if (route === "note" || route === "append" || route === "refine" || route === "search") {
      await ctx.runMutation(internal.teamChat.addAriaMessage, {
        threadId,
        content: pick(DOCS_THINKING_LINES),
      });
    }

    // Step 3: fetch RAG context for all non-chat paths
    const chunks = route !== "chat" ? await doRag() : [];

    // Step 4: build history messages (for chat/search replies)
    const historyMsgs: ORMsg[] = history.map((m) => ({
      role: m.authorId === "aria" ? "assistant" : "user",
      content: m.content,
    }));

    // ── APPEND path (chat mode) ────────────────────────────────────────────
    if (route === "append") {
      if (!noteId) {
        await sleep(1000);
        await ctx.runMutation(internal.teamChat.addAriaMessage, {
          threadId,
          content: "Which note should I add to? Attach it with /notename first 📎",
        });
        return;
      }
      let appendContent = "";
      if (orKey) {
        try {
          appendContent = await orCall(
            orKey,
            MODEL_GOOD,
            MODEL_GOOD_FB,
            [
              { role: "system", content: APPEND_SYSTEM },
              { role: "user", content: buildNotePrompt(content, chunks) },
            ],
            1024,
          );
        } catch (err) {
          console.error("aria: chat-append generation failed", err);
        }
      }
      if (!appendContent) {
        appendContent = `## Aria's Addition\n\n*Aria couldn't generate content — API may be unavailable.*`;
      }
      const appendSources = extractSources(appendContent);
      await ctx.runMutation(internal.meetings.ariaAppend, {
        id: noteId,
        appendMd: stripSources(appendContent),
        newSources: appendSources.length > 0 ? appendSources : undefined,
      });
      await sleep(1000);
      await ctx.runMutation(internal.teamChat.addAriaMessage, {
        threadId,
        content: pick(DONE_APPEND_FNS)(),
        ariaTaskNoteId: noteId,
      });
      return;
    }

    // ── REFINE path (chat mode) ────────────────────────────────────────────
    if (route === "refine") {
      if (!noteId) {
        await sleep(1000);
        await ctx.runMutation(internal.teamChat.addAriaMessage, {
          threadId,
          content: "Which note should I refine? Attach it with /notename first 📎",
        });
        return;
      }
      const existingNote = await ctx.runQuery(internal.meetings.getByIdInternal, { id: noteId });
      let refinedContent = "";
      if (orKey && existingNote) {
        const refinePrompt = `User instruction: ${content}\n\n--- Existing Note ---\n${existingNote.content}\n--- End Note ---\n\n${buildNotePrompt(content, chunks)}`;
        try {
          refinedContent = await orCall(
            orKey,
            MODEL_GOOD,
            MODEL_GOOD_FB,
            [
              { role: "system", content: REFINE_SYSTEM },
              { role: "user", content: refinePrompt },
            ],
            2048,
          );
        } catch (err) {
          console.error("aria: chat-refine generation failed", err);
        }
      }
      if (!refinedContent) {
        await sleep(1000);
        await ctx.runMutation(internal.teamChat.addAriaMessage, {
          threadId,
          content: "Hmm, I couldn't refine the note right now — API might be unavailable. Try again in a sec? 😅",
        });
        return;
      }
      const refineSources = extractSources(refinedContent);
      const refineTitle = extractNoteTitle(refinedContent);
      await ctx.runMutation(internal.meetings.ariaReplace, {
        id: noteId,
        content: stripSources(refinedContent),
        ...(refineTitle ? { title: refineTitle } : {}),
        newSources: refineSources.length > 0 ? refineSources : undefined,
      });
      await sleep(1000);
      await ctx.runMutation(internal.teamChat.addAriaMessage, {
        threadId,
        content: pick(DONE_REFINE_FNS)(),
        ariaTaskNoteId: noteId,
      });
      return;
    }

    // ── NEW NOTE path (chat mode) ──────────────────────────────────────────
    if (route === "note") {
      let noteContent = "";
      try {
        noteContent = await orCall(
          orKey,
          MODEL_GOOD,
          MODEL_GOOD_FB,
          [
            { role: "system", content: NOTE_SYSTEM },
            { role: "user", content: buildNotePrompt(content, chunks) },
          ],
          2048,
        );
      } catch (err) {
        console.error("aria: note generation failed", err);
      }

      if (!noteContent) {
        noteContent = `# ${extractTitle(content)}\n\n*Aria couldn't generate this note — API may be unavailable.*`;
      }

      const noteSources2 = extractSources(noteContent);
      const chatNoteId = await ctx.runMutation(internal.aria.insertNote, {
        title: extractNoteTitle(noteContent) || extractTitle(content),
        content: stripSources(noteContent),
        authorId,
        sources: noteSources2.length > 0 ? noteSources2 : undefined,
      });

      const doneLine =
        chunks.length > 0 ? pick(DONE_FNS)(chunks.length) : pick(NO_CONTEXT_LINES);

      await sleep(1000);
      await ctx.runMutation(internal.teamChat.addAriaMessage, {
        threadId,
        content: doneLine,
        ariaTaskNoteId: chatNoteId,
      });

      return;
    }

    // ── SEARCH / CHAT path ─────────────────────────────────────────────────
    let ragContext = "";
    if (chunks.length > 0) {
      ragContext =
        "\n\n[Relevant project docs]\n" +
        chunks
          .map((c, i) => `${i + 1}. ${c.documentName}: ${c.text.slice(0, 400)}`)
          .join("\n");
    }

    let reply = "";
    try {
      reply = await orCall(
        orKey,
        MODEL_GOOD,
        MODEL_GOOD_FB,
        [
          { role: "system", content: CHAT_SYSTEM + ragContext },
          ...historyMsgs.slice(-8),
          { role: "user", content },
        ],
        400,
      );
    } catch (err) {
      console.error("aria: chat reply failed", err);
    }

    if (!reply) {
      await ctx.runMutation(internal.teamChat.addAriaMessage, {
        threadId,
        content: "Something went wrong on my end 😅 Try again?",
      });
      return;
    }

    // Split into max 2 paragraphs and send each as a separate message
    const paragraphs = reply.split(/\n\n+/).map((p) => p.trim()).filter(Boolean).slice(0, 2);
    for (let i = 0; i < paragraphs.length; i++) {
      if (i > 0) await sleep(1000);
      await ctx.runMutation(internal.teamChat.addAriaMessage, { threadId, content: paragraphs[i] });
    }
  },
});
