import { v } from "convex/values";
import { mutation, query, internalMutation } from "./_generated/server";

export const list = query({
  args: { limit: v.optional(v.number()) },
  handler: async (ctx, { limit }) => {
    return await ctx.db
      .query("threads")
      .withIndex("by_lastMessageAt")
      .order("desc")
      .take(limit ?? 30);
  },
});

export const get = query({
  args: { threadId: v.id("threads") },
  handler: async (ctx, { threadId }) => {
    return await ctx.db.get(threadId);
  },
});

export const create = mutation({
  args: { title: v.optional(v.string()) },
  handler: async (ctx, { title }) => {
    const now = Date.now();
    return await ctx.db.insert("threads", {
      title: title ?? "New session",
      createdAt: now,
      lastMessageAt: now,
    });
  },
});

export const touch = internalMutation({
  args: { threadId: v.id("threads"), title: v.optional(v.string()) },
  handler: async (ctx, { threadId, title }) => {
    const patch: Record<string, unknown> = { lastMessageAt: Date.now() };
    if (title) patch.title = title;
    await ctx.db.patch(threadId, patch);
  },
});

export const setTitle = mutation({
  args: { threadId: v.id("threads"), title: v.string() },
  handler: async (ctx, { threadId, title }) => {
    await ctx.db.patch(threadId, { title });
  },
});

export const remove = mutation({
  args: { threadId: v.id("threads") },
  handler: async (ctx, { threadId }) => {
    let cursor: string | null = null;
    let done = false;
    while (!done) {
      const page = await ctx.db
        .query("messages")
        .withIndex("by_thread", (q) => q.eq("threadId", threadId))
        .paginate({ numItems: 100, cursor });
      for (const m of page.page) await ctx.db.delete(m._id);
      done = page.isDone;
      cursor = page.continueCursor;
    }
    await ctx.db.delete(threadId);
  },
});
