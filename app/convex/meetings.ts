import { v } from "convex/values";
import { mutation, query } from "./_generated/server";

export const list = query({
  args: {},
  handler: async (ctx) => {
    return ctx.db
      .query("meetingNotes")
      .withIndex("by_date")
      .order("desc")
      .take(100);
  },
});

export const get = query({
  args: { id: v.id("meetingNotes") },
  handler: async (ctx, { id }) => ctx.db.get(id),
});

export const create = mutation({
  args: {
    title: v.string(),
    date: v.number(),
    attendees: v.array(v.string()),
    content: v.string(),
    createdBy: v.string(),
  },
  handler: async (ctx, args) => {
    return ctx.db.insert("meetingNotes", { ...args, updatedAt: Date.now() });
  },
});

export const update = mutation({
  args: {
    id: v.id("meetingNotes"),
    title: v.optional(v.string()),
    content: v.optional(v.string()),
    attendees: v.optional(v.array(v.string())),
    date: v.optional(v.number()),
  },
  handler: async (ctx, { id, ...fields }) => {
    const updates = Object.fromEntries(
      Object.entries(fields).filter(([, val]) => val !== undefined),
    );
    await ctx.db.patch(id, { ...updates, updatedAt: Date.now() });
  },
});

export const remove = mutation({
  args: { id: v.id("meetingNotes") },
  handler: async (ctx, { id }) => ctx.db.delete(id),
});
