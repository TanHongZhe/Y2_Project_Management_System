import { v } from "convex/values";
import { mutation, query, internalMutation, internalQuery } from "./_generated/server";
import { internal } from "./_generated/api";
import { Id } from "./_generated/dataModel";

// ── Threads ──────────────────────────────────────────────────────────────────

export const getOrCreateGroup = mutation({
  args: {},
  handler: async (ctx) => {
    const existing = await ctx.db
      .query("chatThreads")
      .withIndex("by_type", (q) => q.eq("type", "group"))
      .first();
    if (existing) return existing._id;
    return ctx.db.insert("chatThreads", {
      type: "group",
      participants: [],
      name: "General",
    });
  },
});

export const getOrCreateDm = mutation({
  args: { userId: v.string(), otherUserId: v.string() },
  handler: async (ctx, { userId, otherUserId }) => {
    const sorted = [userId, otherUserId].sort();
    const threads = await ctx.db
      .query("chatThreads")
      .withIndex("by_type", (q) => q.eq("type", "dm"))
      .collect();
    const existing = threads.find(
      (t) =>
        t.participants.length === 2 &&
        t.participants.includes(sorted[0]) &&
        t.participants.includes(sorted[1]),
    );
    if (existing) return existing._id;
    return ctx.db.insert("chatThreads", {
      type: "dm",
      participants: sorted,
    });
  },
});

export const listThreadsForUser = query({
  args: { userId: v.string() },
  handler: async (ctx, { userId }) => {
    const all = await ctx.db.query("chatThreads").collect();
    return all
      .filter((t) => t.type === "group" || t.participants.includes(userId))
      .sort((a, b) => (b.lastMessageAt ?? 0) - (a.lastMessageAt ?? 0));
  },
});

export const recentMessages = internalQuery({
  args: { threadId: v.id("chatThreads"), limit: v.optional(v.number()) },
  handler: async (ctx, { threadId, limit }) => {
    const msgs = await ctx.db
      .query("chatMessages")
      .withIndex("by_thread", (q) => q.eq("threadId", threadId))
      .order("desc")
      .take(limit ?? 10);
    return msgs.reverse();
  },
});

// ── Messages ─────────────────────────────────────────────────────────────────

export const listMessages = query({
  args: { threadId: v.id("chatThreads"), limit: v.optional(v.number()) },
  handler: async (ctx, { threadId, limit }) => {
    return ctx.db
      .query("chatMessages")
      .withIndex("by_thread", (q) => q.eq("threadId", threadId))
      .order("asc")
      .take(limit ?? 200);
  },
});

export const sendMessage = mutation({
  args: {
    threadId: v.id("chatThreads"),
    authorId: v.string(),
    content: v.string(),
    mentions: v.optional(v.array(v.string())),
  },
  handler: async (ctx, { threadId, authorId, content, mentions }) => {
    const msgId = await ctx.db.insert("chatMessages", {
      threadId,
      authorId,
      content,
      createdAt: Date.now(),
      mentions,
    });

    await ctx.db.patch(threadId, { lastMessageAt: Date.now(), lastAuthorId: authorId });

    // Parse article reference [note:<id> <title>] and inject content for Aria
    let enrichedContent = content;
    let articleNoteId: Id<"meetingNotes"> | undefined;
    const noteRefMatch = content.match(/\[note:([a-z0-9]+)\s[^\]]*\]/i);
    if (noteRefMatch) {
      try {
        const refId = noteRefMatch[1] as Id<"meetingNotes">;
        const noteDoc = await ctx.db.get(refId);
        if (noteDoc) {
          articleNoteId = refId;
          enrichedContent =
            content +
            `\n\n--- Referenced Article: "${noteDoc.title}" ---\n${noteDoc.content}\n--- End Article ---`;
        }
      } catch {
        // invalid id — ignore
      }
    }

    // Determine whether Aria will respond (needed for auto-context)
    const thread = await ctx.db.get(threadId);
    const isAriaDm =
      thread?.type === "dm" &&
      thread.participants.includes("aria") &&
      authorId !== "aria";
    const mentionsAria =
      content.toLowerCase().includes("@aria") && authorId !== "aria";

    // Auto-context: when Aria will respond and no note chip was attached,
    // scan recent thread messages for the last ariaTaskNoteId so the user can
    // say "refine this" / "add a section on X" without re-attaching the chip.
    if ((mentionsAria || isAriaDm) && !articleNoteId) {
      const recentMsgs = await ctx.db
        .query("chatMessages")
        .withIndex("by_thread", (q) => q.eq("threadId", threadId))
        .order("desc")
        .take(20);
      const lastTaskMsg = recentMsgs.find((m) => m.ariaTaskNoteId);
      if (lastTaskMsg?.ariaTaskNoteId) {
        articleNoteId = lastTaskMsg.ariaTaskNoteId;
        try {
          const noteDoc = await ctx.db.get(articleNoteId);
          if (noteDoc) {
            enrichedContent =
              content +
              `\n\n--- Context Article: "${noteDoc.title}" ---\n${noteDoc.content}\n--- End Article ---`;
          }
        } catch {
          // invalid id — ignore
        }
      }
    }

    // Aria responds when:
    //  - It's her DM (every message, no @aria needed)
    //  - OR she's @-mentioned (any thread type, including group chat)
    // Both paths use mode: "chat" so the full 5-way router decides whether to
    // chat casually, answer factually with RAG, or create/append/refine a note.
    // The notes editor uses a separate `rag_note` entry point (triggerAriaFromNote).
    if (isAriaDm || mentionsAria) {
      await ctx.scheduler.runAfter(0, internal.aria.handleMention, {
        threadId,
        authorId,
        content: enrichedContent,
        mode: "chat",
        ...(articleNoteId ? { noteId: articleNoteId } : {}),
      });
    }

    return msgId;
  },
});

// Called from the Notes editor when @aria is mentioned — opens the user's Aria
// DM thread and kicks off note generation as if they'd messaged Aria directly.
export const triggerAriaFromNote = mutation({
  args: { authorId: v.string(), content: v.string(), noteId: v.optional(v.id("meetingNotes")) },
  handler: async (ctx, { authorId, content, noteId }) => {
    const sorted = [authorId, "aria"].sort();
    const dms = await ctx.db
      .query("chatThreads")
      .withIndex("by_type", (q) => q.eq("type", "dm"))
      .collect();
    const existing = dms.find(
      (t) =>
        t.participants.length === 2 &&
        t.participants.includes(sorted[0]) &&
        t.participants.includes(sorted[1]),
    );
    const threadId = existing
      ? existing._id
      : await ctx.db.insert("chatThreads", { type: "dm", participants: sorted });

    // Post the request as a visible user message so it appears in the DM thread
    await ctx.db.insert("chatMessages", {
      threadId,
      authorId,
      content,
      createdAt: Date.now(),
    });
    await ctx.db.patch(threadId, { lastMessageAt: Date.now(), lastAuthorId: authorId });

    await ctx.scheduler.runAfter(0, internal.aria.handleMention, {
      threadId,
      authorId,
      content,
      mode: "rag_note",
      ...(noteId ? { noteId } : {}),
    });
  },
});

export const clearThread = mutation({
  args: { threadId: v.id("chatThreads") },
  handler: async (ctx, { threadId }) => {
    const msgs = await ctx.db
      .query("chatMessages")
      .withIndex("by_thread", (q) => q.eq("threadId", threadId))
      .collect();
    await Promise.all(msgs.map((m) => ctx.db.delete(m._id)));
  },
});

export const addAriaMessage = internalMutation({
  args: {
    threadId: v.id("chatThreads"),
    content: v.string(),
    ariaTaskNoteId: v.optional(v.id("meetingNotes")),
  },
  handler: async (ctx, { threadId, content, ariaTaskNoteId }) => {
    await ctx.db.insert("chatMessages", {
      threadId,
      authorId: "aria",
      content,
      createdAt: Date.now(),
      ariaTaskNoteId,
    });
    await ctx.db.patch(threadId, { lastMessageAt: Date.now(), lastAuthorId: "aria" });
  },
});
