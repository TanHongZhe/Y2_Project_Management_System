import { v } from "convex/values";
import { action, internalMutation, internalQuery, mutation, query } from "./_generated/server";
import { internal } from "./_generated/api";
import { Doc, Id } from "./_generated/dataModel";

// Public version of getContentHash — used by the Meetings UI to derive a
// persistent "Indexed ✓" state without storing anything client-side.
export const getStoredHash = query({
  args: { noteId: v.id("meetingNotes") },
  handler: async (ctx, { noteId }): Promise<string | null> => {
    const first = await ctx.db
      .query("noteChunks")
      .withIndex("by_note", (q) => q.eq("noteId", noteId))
      .first();
    return first?.contentHash ?? null;
  },
});

// One-shot table wipe — used to clear stale rows when the noteId type changed
// from memoryNotes → meetingNotes. Run once from the Convex dashboard:
//   noteChunks:clearAll
// then delete this export.
export const clearAll = mutation({
  args: {},
  handler: async (ctx) => {
    const all = await ctx.db.query("noteChunks").collect();
    await Promise.all(all.map((c) => ctx.db.delete(c._id)));
    return { deleted: all.length };
  },
});

const EMBED_MODEL = "text-embedding-3-small";
const EMBED_DIM = 1536;

// ── Internal helpers ────────────────────────────────────────────────────────

export const getContentHash = internalQuery({
  args: { noteId: v.id("meetingNotes") },
  handler: async (ctx, { noteId }): Promise<string | null> => {
    const first = await ctx.db
      .query("noteChunks")
      .withIndex("by_note", (q) => q.eq("noteId", noteId))
      .first();
    return first?.contentHash ?? null;
  },
});

export const deleteByNote = internalMutation({
  args: { noteId: v.id("meetingNotes") },
  handler: async (ctx, { noteId }) => {
    const existing = await ctx.db
      .query("noteChunks")
      .withIndex("by_note", (q) => q.eq("noteId", noteId))
      .collect();
    await Promise.all(existing.map((c) => ctx.db.delete(c._id)));
  },
});

export const insertBatch = internalMutation({
  args: {
    noteId: v.id("meetingNotes"),
    section: v.string(),
    contentHash: v.string(),
    chunks: v.array(
      v.object({
        text: v.string(),
        embedding: v.array(v.number()),
        chunkIndex: v.number(),
      }),
    ),
  },
  handler: async (ctx, { noteId, section, contentHash, chunks }) => {
    await Promise.all(
      chunks.map((c) =>
        ctx.db.insert("noteChunks", {
          noteId,
          section,
          text: c.text,
          embedding: c.embedding,
          chunkIndex: c.chunkIndex,
          contentHash,
        }),
      ),
    );
  },
});

export const getByIds = internalQuery({
  args: { ids: v.array(v.id("noteChunks")) },
  handler: async (ctx, { ids }): Promise<(Doc<"noteChunks"> | null)[]> => {
    return Promise.all(ids.map((id) => ctx.db.get(id)));
  },
});

export const searchByText = internalQuery({
  args: { query: v.string(), limit: v.optional(v.number()) },
  handler: async (ctx, { query, limit }): Promise<Doc<"noteChunks">[]> => {
    return ctx.db
      .query("noteChunks")
      .withSearchIndex("search_text", (q) => q.search("text", query))
      .take(limit ?? 5);
  },
});

// ── Utilities ───────────────────────────────────────────────────────────────

async function hashText(text: string): Promise<string> {
  const encoded = new TextEncoder().encode(text);
  const buf = await crypto.subtle.digest("SHA-256", encoded);
  return Array.from(new Uint8Array(buf))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("")
    .slice(0, 16);
}

async function embedTexts(apiKey: string, texts: string[]): Promise<number[][]> {
  const res = await fetch("https://api.openai.com/v1/embeddings", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({ model: EMBED_MODEL, input: texts }),
  });
  if (!res.ok) {
    const err = await res.text();
    throw new Error(`embed failed (${res.status}): ${err.slice(0, 200)}`);
  }
  const data = (await res.json()) as {
    data: { embedding: number[]; index: number }[];
  };
  return data.data
    .sort((a, b) => a.index - b.index)
    .map((d) => {
      if (d.embedding.length !== EMBED_DIM)
        throw new Error(`unexpected embedding length ${d.embedding.length}`);
      return d.embedding;
    });
}

// Split note content into chunks by paragraph, with a reasonable upper bound.
function chunkContent(content: string): string[] {
  return content
    .split(/\n{2,}/)
    .map((s) => s.trim())
    .filter((s) => s.length >= 20)
    .slice(0, 40);
}

// ── Public action (called from client) ─────────────────────────────────────

export const ingestNote = action({
  args: {
    noteId: v.id("meetingNotes"),
    content: v.string(),
    section: v.string(),
  },
  handler: async (ctx, { noteId, content, section }) => {
    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) return;

    const trimmed = content.trim();
    if (!trimmed) return;

    // Skip if content hasn't changed since last ingest
    const hash = await hashText(trimmed);
    const existingHash: string | null = await ctx.runQuery(
      internal.noteChunks.getContentHash,
      { noteId },
    );
    if (existingHash === hash) return;

    const texts = chunkContent(trimmed);
    if (texts.length === 0) return;

    const embeddings = await embedTexts(apiKey, texts);

    const chunks = texts.map((text, i) => ({
      text,
      embedding: embeddings[i],
      chunkIndex: i,
    }));

    // Atomic replace: delete stale chunks then insert fresh ones
    await ctx.runMutation(internal.noteChunks.deleteByNote, { noteId });
    await ctx.runMutation(internal.noteChunks.insertBatch, {
      noteId,
      section,
      contentHash: hash,
      chunks,
    });
  },
});
