import { mutation, query } from "./_generated/server";
import { v } from "convex/values";

export const list = query({
  args: {},
  handler: async (ctx) => {
    return ctx.db
      .query("todos")
      .withIndex("by_createdAt")
      .order("asc")
      .take(100);
  },
});

export const add = mutation({
  args: { text: v.string() },
  handler: async (ctx, args) => {
    await ctx.db.insert("todos", {
      text: args.text,
      done: false,
      assignedTo: [],
      createdAt: Date.now(),
    });
  },
});

export const toggle = mutation({
  args: { id: v.id("todos") },
  handler: async (ctx, args) => {
    const todo = await ctx.db.get(args.id);
    if (!todo) return;
    await ctx.db.patch(args.id, { done: !todo.done });
  },
});

export const remove = mutation({
  args: { id: v.id("todos") },
  handler: async (ctx, args) => {
    await ctx.db.delete(args.id);
  },
});

export const setAssignees = mutation({
  args: { id: v.id("todos"), assignedTo: v.array(v.string()) },
  handler: async (ctx, args) => {
    await ctx.db.patch(args.id, { assignedTo: args.assignedTo });
  },
});

export const setDueDate = mutation({
  args: { id: v.id("todos"), dueDate: v.optional(v.number()) },
  handler: async (ctx, args) => {
    await ctx.db.patch(args.id, { dueDate: args.dueDate });
  },
});

export const setImportant = mutation({
  args: { id: v.id("todos"), important: v.boolean() },
  handler: async (ctx, args) => {
    await ctx.db.patch(args.id, { important: args.important });
  },
});
