import { v } from "convex/values";
import { mutation, query, internalMutation } from "./_generated/server";

export const list = query({
  args: {},
  handler: async (ctx) => {
    return await ctx.db
      .query("memoryNotes")
      .withIndex("by_section")
      .order("asc")
      .take(200);
  },
});

export const upsert = mutation({
  args: {
    section: v.string(),
    content: v.string(),
    author: v.optional(v.string()),
  },
  handler: async (ctx, { section, content, author }) => {
    const existing = await ctx.db
      .query("memoryNotes")
      .withIndex("by_section", (q) => q.eq("section", section))
      .first();
    const now = Date.now();
    if (existing) {
      await ctx.db.patch(existing._id, {
        content,
        author: author ?? existing.author,
        updatedAt: now,
      });
      return existing._id;
    }
    return await ctx.db.insert("memoryNotes", {
      section,
      content,
      author: author ?? "you",
      updatedAt: now,
    });
  },
});

export const upsertInternal = internalMutation({
  args: {
    section: v.string(),
    content: v.string(),
    author: v.optional(v.string()),
  },
  handler: async (ctx, { section, content, author }) => {
    const existing = await ctx.db
      .query("memoryNotes")
      .withIndex("by_section", (q) => q.eq("section", section))
      .first();
    const now = Date.now();
    if (existing) {
      await ctx.db.patch(existing._id, {
        content,
        author: author ?? existing.author,
        updatedAt: now,
      });
      return existing._id;
    }
    return await ctx.db.insert("memoryNotes", {
      section,
      content,
      author: author ?? "ai",
      updatedAt: now,
    });
  },
});

export const remove = mutation({
  args: { id: v.id("memoryNotes") },
  handler: async (ctx, { id }) => {
    await ctx.db.delete(id);
  },
});
