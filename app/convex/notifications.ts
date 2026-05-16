import { v } from "convex/values";
import { mutation, query } from "./_generated/server";

export const list = query({
  args: { userId: v.string(), limit: v.optional(v.number()) },
  handler: async (ctx, { userId, limit }) =>
    ctx.db
      .query("notifications")
      .withIndex("by_userId_createdAt", (q) => q.eq("userId", userId))
      .order("desc")
      .take(limit ?? 20),
});

export const unreadCount = query({
  args: { userId: v.string() },
  handler: async (ctx, { userId }) => {
    const recent = await ctx.db
      .query("notifications")
      .withIndex("by_userId_createdAt", (q) => q.eq("userId", userId))
      .order("desc")
      .take(100);
    return recent.filter((n) => !n.read).length;
  },
});

export const markRead = mutation({
  args: { id: v.id("notifications") },
  handler: async (ctx, { id }) => {
    await ctx.db.patch(id, { read: true });
  },
});

export const markAllRead = mutation({
  args: { userId: v.string() },
  handler: async (ctx, { userId }) => {
    const recent = await ctx.db
      .query("notifications")
      .withIndex("by_userId_createdAt", (q) => q.eq("userId", userId))
      .order("desc")
      .take(100);
    await Promise.all(
      recent.filter((n) => !n.read).map((n) => ctx.db.patch(n._id, { read: true })),
    );
  },
});

export const notifyMention = mutation({
  args: {
    userId: v.string(),
    fromUserId: v.string(),
    linkRoute: v.string(),    // "meetings" | "memory" | "tests" | ...
    linkId: v.string(),       // doc id used as dedup key
    contextLabel: v.string(), // human-readable source, e.g. "Meeting 15 May"
  },
  handler: async (ctx, { userId, fromUserId, linkRoute, linkId, contextLabel }) => {
    // Idempotent — one mention per (link, user, type) so re-edits don't re-fire.
    const existing = await ctx.db
      .query("notifications")
      .withIndex("by_linkId_userId_type", (q) =>
        q.eq("linkId", linkId).eq("userId", userId).eq("type", "mention"),
      )
      .first();
    if (existing) return;
    await ctx.db.insert("notifications", {
      userId,
      type: "mention",
      message: `You were mentioned in "${contextLabel}"`,
      linkRoute,
      linkId,
      fromUserId,
      read: false,
      createdAt: Date.now(),
    });
  },
});
