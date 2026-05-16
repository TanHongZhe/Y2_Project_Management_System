import { mutation, query } from "./_generated/server";
import { v } from "convex/values";

export const list = query({
  args: {},
  handler: async (ctx) => {
    return ctx.db
      .query("calendarEvents")
      .withIndex("by_startDate")
      .order("asc")
      .take(500);
  },
});

export const add = mutation({
  args: {
    text: v.string(),
    startDate: v.number(),
    dueDate: v.number(),
    color: v.optional(v.string()),
    assignedTo: v.optional(v.array(v.string())),
  },
  handler: async (ctx, args) => {
    return await ctx.db.insert("calendarEvents", {
      text: args.text,
      done: false,
      assignedTo: args.assignedTo ?? [],
      startDate: args.startDate,
      dueDate: args.dueDate,
      color: args.color,
      createdAt: Date.now(),
    });
  },
});

export const remove = mutation({
  args: { id: v.id("calendarEvents") },
  handler: async (ctx, args) => {
    await ctx.db.delete(args.id);
  },
});

export const setText = mutation({
  args: { id: v.id("calendarEvents"), text: v.string() },
  handler: async (ctx, args) => {
    await ctx.db.patch(args.id, { text: args.text });
  },
});

export const setDateRange = mutation({
  args: {
    id: v.id("calendarEvents"),
    startDate: v.number(),
    dueDate: v.number(),
  },
  handler: async (ctx, args) => {
    await ctx.db.patch(args.id, {
      startDate: args.startDate,
      dueDate: args.dueDate,
    });
  },
});

export const setColor = mutation({
  args: { id: v.id("calendarEvents"), color: v.optional(v.string()) },
  handler: async (ctx, args) => {
    await ctx.db.patch(args.id, { color: args.color });
  },
});

export const setAssignees = mutation({
  args: {
    id: v.id("calendarEvents"),
    assignedTo: v.array(v.string()),
  },
  handler: async (ctx, args) => {
    await ctx.db.patch(args.id, { assignedTo: args.assignedTo });
  },
});

export const toggle = mutation({
  args: { id: v.id("calendarEvents") },
  handler: async (ctx, args) => {
    const ev = await ctx.db.get(args.id);
    if (!ev) return;
    await ctx.db.patch(args.id, { done: !ev.done });
  },
});
