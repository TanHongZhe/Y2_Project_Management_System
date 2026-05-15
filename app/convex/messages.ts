import { v } from "convex/values";
import { mutation, query, internalMutation, internalQuery } from "./_generated/server";

const RoleValidator = v.union(
  v.literal("user"),
  v.literal("assistant"),
  v.literal("system"),
);

const ToolCallValidator = v.object({
  name: v.string(),
  args: v.string(),
  status: v.union(
    v.literal("pending"),
    v.literal("applied"),
    v.literal("error"),
  ),
  result: v.optional(v.string()),
});

const CitationValidator = v.object({
  file: v.string(),
  section: v.optional(v.string()),
  url: v.optional(v.string()),
  score: v.optional(v.number()),
  sent: v.optional(v.boolean()),
});

export const listByThread = query({
  args: { threadId: v.id("threads") },
  handler: async (ctx, { threadId }) => {
    return await ctx.db
      .query("messages")
      .withIndex("by_thread", (q) => q.eq("threadId", threadId))
      .order("asc")
      .take(500);
  },
});

export const listByThreadInternal = internalQuery({
  args: { threadId: v.id("threads"), limit: v.optional(v.number()) },
  handler: async (ctx, { threadId, limit }) => {
    return await ctx.db
      .query("messages")
      .withIndex("by_thread", (q) => q.eq("threadId", threadId))
      .order("desc")
      .take(limit ?? 12);
  },
});

export const send = mutation({
  args: {
    threadId: v.id("threads"),
    role: RoleValidator,
    content: v.string(),
    model: v.optional(v.string()),
    toolCalls: v.optional(v.array(ToolCallValidator)),
    citations: v.optional(v.array(CitationValidator)),
  },
  handler: async (ctx, args) => {
    const id = await ctx.db.insert("messages", {
      ...args,
      createdAt: Date.now(),
    });
    await ctx.db.patch(args.threadId, { lastMessageAt: Date.now() });
    return id;
  },
});

export const sendInternal = internalMutation({
  args: {
    threadId: v.id("threads"),
    role: RoleValidator,
    content: v.string(),
    model: v.optional(v.string()),
    toolCalls: v.optional(v.array(ToolCallValidator)),
    citations: v.optional(v.array(CitationValidator)),
  },
  handler: async (ctx, args) => {
    const id = await ctx.db.insert("messages", {
      ...args,
      createdAt: Date.now(),
    });
    await ctx.db.patch(args.threadId, { lastMessageAt: Date.now() });
    return id;
  },
});
