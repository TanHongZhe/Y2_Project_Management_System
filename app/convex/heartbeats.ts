import { v } from "convex/values";
import { mutation, query } from "./_generated/server";

const ONLINE_THRESHOLD_MS = 75_000; // 75 s — generous so 30s ping interval has headroom

export const ping = mutation({
  args: { userId: v.string() },
  handler: async (ctx, { userId }) => {
    const existing = await ctx.db
      .query("heartbeats")
      .withIndex("by_userId", (q) => q.eq("userId", userId))
      .first();
    if (existing) {
      await ctx.db.patch(existing._id, { lastSeen: Date.now() });
    } else {
      await ctx.db.insert("heartbeats", { userId, lastSeen: Date.now() });
    }
  },
});

export const getOnlineUserIds = query({
  args: {},
  handler: async (ctx) => {
    const cutoff = Date.now() - ONLINE_THRESHOLD_MS;
    const beats = await ctx.db
      .query("heartbeats")
      .withIndex("by_lastSeen", (q) => q.gt("lastSeen", cutoff))
      .collect();
    return beats.map((b) => b.userId);
  },
});
