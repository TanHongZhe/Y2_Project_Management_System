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
    linkRoute: v.string(),
    linkId: v.string(),
    contextLabel: v.string(),
  },
  handler: async (ctx, { userId, fromUserId, linkRoute, linkId, contextLabel }) => {
    const existing = await ctx.db
      .query("notifications")
      .withIndex("by_linkId_userId_type", (q) =>
        q.eq("linkId", linkId).eq("userId", userId).eq("type", "mention"),
      )
      .first();
    if (existing) {
      await ctx.db.patch(existing._id, {
        read: false,
        createdAt: Date.now(),
        message: `You were mentioned in "${contextLabel}"`,
        fromUserId,
      });
      return;
    }
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

// Syncs mention notifications to exactly match the current set of @mentions in
// the editor. Creates for new mentions, deletes for removed ones, and
// re-surfaces (marks unread) any already-read notifications on re-mention.
export const syncMentions = mutation({
  args: {
    linkId: v.string(),
    linkRoute: v.string(),
    contextLabel: v.string(),
    fromUserId: v.string(),
    mentionedUserIds: v.array(v.string()),
  },
  handler: async (ctx, { linkId, linkRoute, contextLabel, fromUserId, mentionedUserIds }) => {
    // Fetch all existing mention notifications for this meeting.
    // Querying with just the first index field (linkId) returns all rows for that link.
    const allForLink = await ctx.db
      .query("notifications")
      .withIndex("by_linkId_userId_type", (q) => q.eq("linkId", linkId))
      .collect();
    const existingMentions = allForLink.filter((n) => n.type === "mention");

    const currentSet = new Set(mentionedUserIds);
    const existingMap = new Map(existingMentions.map((n) => [n.userId, n]));

    // 1. Delete notifications for users who are no longer @mentioned
    for (const n of existingMentions) {
      if (!currentSet.has(n.userId)) {
        await ctx.db.delete(n._id);
      }
    }

    // 2. Create or refresh notifications for currently @mentioned users
    for (const userId of mentionedUserIds) {
      const existing = existingMap.get(userId);
      if (!existing) {
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
      } else if (existing.read) {
        // Re-surface: mark unread so they notice it again
        await ctx.db.patch(existing._id, { read: false, createdAt: Date.now() });
      }
    }
  },
});
