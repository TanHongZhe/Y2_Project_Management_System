import { v } from "convex/values";
import { mutation, query } from "./_generated/server";

export const list = query({
  args: { threadId: v.string() },
  handler: async (ctx, { threadId }) => {
    return await ctx.db
      .query("messages")
      .withIndex("by_thread", (q) => q.eq("threadId", threadId))
      .order("asc")
      .collect();
  },
});

export const send = mutation({
  args: {
    threadId: v.string(),
    role: v.union(v.literal("user"), v.literal("assistant"), v.literal("system")),
    content: v.string(),
    model: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    return await ctx.db.insert("messages", {
      ...args,
      createdAt: Date.now(),
    });
  },
});
