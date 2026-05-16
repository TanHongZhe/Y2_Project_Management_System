import { mutation, query, internalQuery } from "./_generated/server";
import { internal } from "./_generated/api";
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
  args: { text: v.string(), dueDate: v.optional(v.number()), details: v.optional(v.string()) },
  handler: async (ctx, args) => {
    await ctx.db.insert("todos", {
      text: args.text,
      details: args.details,
      done: false,
      assignedTo: [],
      createdAt: Date.now(),
      dueDate: args.dueDate,
    });
  },
});

export const setText = mutation({
  args: { id: v.id("todos"), text: v.string() },
  handler: async (ctx, args) => {
    await ctx.db.patch(args.id, { text: args.text });
  },
});

export const setDetails = mutation({
  args: { id: v.id("todos"), details: v.string() },
  handler: async (ctx, args) => {
    await ctx.db.patch(args.id, { details: args.details });
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
    const existing = await ctx.db.get(args.id);
    const oldSet = new Set(existing?.assignedTo ?? []);
    const newlyAdded = args.assignedTo.filter((u) => !oldSet.has(u));

    await ctx.db.patch(args.id, { assignedTo: args.assignedTo });

    for (const userId of newlyAdded) {
      await ctx.scheduler.runAfter(0, internal.email.sendAssignedEmail, {
        todoId: args.id,
        userId,
      });
    }
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

export const getById = internalQuery({
  args: { id: v.id("todos") },
  handler: async (ctx, { id }) => ctx.db.get(id),
});

export const getDueSoon = internalQuery({
  args: { from: v.number(), to: v.number() },
  handler: async (ctx, { from, to }) => {
    const all = await ctx.db
      .query("todos")
      .withIndex("by_createdAt")
      .collect();
    return all.filter(
      (t) => !t.done && t.dueDate !== undefined && t.dueDate >= from && t.dueDate <= to,
    );
  },
});

export const getOverdue = internalQuery({
  args: { before: v.number() },
  handler: async (ctx, { before }) => {
    const all = await ctx.db
      .query("todos")
      .withIndex("by_createdAt")
      .collect();
    return all.filter(
      (t) => !t.done && t.dueDate !== undefined && t.dueDate < before,
    );
  },
});
