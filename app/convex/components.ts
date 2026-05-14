import { v } from "convex/values";
import { mutation, query, internalMutation, MutationCtx } from "./_generated/server";

const StatusValidator = v.union(
  v.literal("planned"),
  v.literal("ordered"),
  v.literal("received"),
  v.literal("installed"),
);

async function nextRef(ctx: MutationCtx): Promise<string> {
  const recent = await ctx.db
    .query("components")
    .withIndex("by_ref")
    .order("desc")
    .take(50);
  let max = 0;
  for (const c of recent) {
    const m = /^C-(\d+)$/.exec(c.ref);
    if (m) {
      const n = parseInt(m[1], 10);
      if (n > max) max = n;
    }
  }
  return `C-${String(max + 1).padStart(2, "0")}`;
}

export const list = query({
  args: { limit: v.optional(v.number()) },
  handler: async (ctx, { limit }) => {
    return await ctx.db
      .query("components")
      .withIndex("by_ref")
      .order("asc")
      .take(limit ?? 500);
  },
});

export const create = mutation({
  args: {
    name: v.string(),
    qty: v.number(),
    unit: v.optional(v.string()),
    estCost: v.number(),
    status: v.optional(StatusValidator),
    supplier: v.optional(v.string()),
    model: v.optional(v.string()),
    specs: v.optional(v.string()),
    notes: v.optional(v.string()),
    tags: v.optional(v.array(v.string())),
    ref: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const ref = args.ref ?? (await nextRef(ctx));
    const docId = await ctx.db.insert("components", {
      ref,
      name: args.name,
      qty: args.qty,
      unit: args.unit,
      estCost: args.estCost,
      status: args.status ?? "planned",
      supplier: args.supplier,
      model: args.model,
      specs: args.specs,
      notes: args.notes,
      tags: args.tags ?? [],
      createdAt: Date.now(),
    });
    return { docId, ref };
  },
});

export const createInternal = internalMutation({
  args: {
    name: v.string(),
    qty: v.number(),
    unit: v.optional(v.string()),
    estCost: v.number(),
    status: v.optional(StatusValidator),
    supplier: v.optional(v.string()),
    model: v.optional(v.string()),
    specs: v.optional(v.string()),
    notes: v.optional(v.string()),
    tags: v.optional(v.array(v.string())),
    ref: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const ref = args.ref ?? (await nextRef(ctx));
    const docId = await ctx.db.insert("components", {
      ref,
      name: args.name,
      qty: args.qty,
      unit: args.unit,
      estCost: args.estCost,
      status: args.status ?? "planned",
      supplier: args.supplier,
      model: args.model,
      specs: args.specs,
      notes: args.notes,
      tags: args.tags ?? [],
      createdAt: Date.now(),
    });
    return { docId, ref };
  },
});

export const update = mutation({
  args: {
    id: v.id("components"),
    status: v.optional(StatusValidator),
    estCost: v.optional(v.number()),
    qty: v.optional(v.number()),
    supplier: v.optional(v.string()),
    notes: v.optional(v.string()),
  },
  handler: async (ctx, { id, ...patch }) => {
    const clean: Record<string, unknown> = {};
    for (const [k, v2] of Object.entries(patch)) {
      if (v2 !== undefined) clean[k] = v2;
    }
    await ctx.db.patch(id, clean);
  },
});

export const remove = mutation({
  args: { id: v.id("components") },
  handler: async (ctx, { id }) => {
    await ctx.db.delete(id);
  },
});
