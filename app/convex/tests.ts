import { v } from "convex/values";
import { mutation, query, internalMutation, MutationCtx } from "./_generated/server";

const ResultValidator = v.union(
  v.literal("pass"),
  v.literal("fail"),
  v.literal("pending"),
);

const MetricValidator = v.object({
  key: v.string(),
  value: v.string(),
  unit: v.optional(v.string()),
});

async function nextTestId(ctx: MutationCtx): Promise<string> {
  const recent = await ctx.db
    .query("tests")
    .withIndex("by_testId")
    .order("desc")
    .take(50);
  let max = 0;
  for (const t of recent) {
    const m = /^T-(\d+)$/.exec(t.testId);
    if (m) {
      const n = parseInt(m[1], 10);
      if (n > max) max = n;
    }
  }
  return `T-${String(max + 1).padStart(3, "0")}`;
}

export const list = query({
  args: { subsystem: v.optional(v.string()), limit: v.optional(v.number()) },
  handler: async (ctx, { subsystem, limit }) => {
    if (subsystem) {
      return await ctx.db
        .query("tests")
        .withIndex("by_subsystem", (q) => q.eq("subsystem", subsystem))
        .order("desc")
        .take(limit ?? 200);
    }
    return await ctx.db
      .query("tests")
      .withIndex("by_testedAt")
      .order("desc")
      .take(limit ?? 200);
  },
});

export const create = mutation({
  args: {
    title: v.string(),
    subsystem: v.string(),
    result: v.optional(ResultValidator),
    metrics: v.optional(v.array(MetricValidator)),
    conditions: v.optional(v.string()),
    notes: v.optional(v.string()),
    author: v.optional(v.string()),
    testId: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const testId = args.testId ?? (await nextTestId(ctx));
    const docId = await ctx.db.insert("tests", {
      testId,
      title: args.title,
      subsystem: args.subsystem,
      result: args.result ?? "pending",
      metrics: args.metrics ?? [],
      conditions: args.conditions,
      notes: args.notes,
      testedAt: Date.now(),
      author: args.author ?? "you",
    });
    return { docId, testId };
  },
});

export const createInternal = internalMutation({
  args: {
    title: v.string(),
    subsystem: v.string(),
    result: v.optional(ResultValidator),
    metrics: v.optional(v.array(MetricValidator)),
    conditions: v.optional(v.string()),
    notes: v.optional(v.string()),
    author: v.optional(v.string()),
    testId: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const testId = args.testId ?? (await nextTestId(ctx));
    const docId = await ctx.db.insert("tests", {
      testId,
      title: args.title,
      subsystem: args.subsystem,
      result: args.result ?? "pending",
      metrics: args.metrics ?? [],
      conditions: args.conditions,
      notes: args.notes,
      testedAt: Date.now(),
      author: args.author ?? "ai",
    });
    return { docId, testId };
  },
});

export const remove = mutation({
  args: { id: v.id("tests") },
  handler: async (ctx, { id }) => {
    await ctx.db.delete(id);
  },
});
