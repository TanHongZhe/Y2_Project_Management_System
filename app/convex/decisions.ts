import { v } from "convex/values";
import { mutation, query, internalMutation, MutationCtx } from "./_generated/server";

async function nextDecisionId(ctx: MutationCtx): Promise<string> {
  const recent = await ctx.db
    .query("decisions")
    .withIndex("by_decisionId")
    .order("desc")
    .take(50);
  let max = 0;
  for (const d of recent) {
    const m = /^D-(\d+)$/.exec(d.decisionId);
    if (m) {
      const n = parseInt(m[1], 10);
      if (n > max) max = n;
    }
  }
  return `D-${String(max + 1).padStart(3, "0")}`;
}

export const list = query({
  args: { limit: v.optional(v.number()) },
  handler: async (ctx, { limit }) => {
    return await ctx.db
      .query("decisions")
      .withIndex("by_createdAt")
      .order("desc")
      .take(limit ?? 200);
  },
});

export const create = mutation({
  args: {
    title: v.string(),
    rationale: v.string(),
    tags: v.array(v.string()),
    decisionId: v.optional(v.string()),
  },
  handler: async (ctx, { title, rationale, tags, decisionId }) => {
    const id = decisionId ?? (await nextDecisionId(ctx));
    const docId = await ctx.db.insert("decisions", {
      decisionId: id,
      title,
      rationale,
      tags,
      createdAt: Date.now(),
    });
    return { docId, decisionId: id };
  },
});

export const createInternal = internalMutation({
  args: {
    title: v.string(),
    rationale: v.string(),
    tags: v.array(v.string()),
    decisionId: v.optional(v.string()),
  },
  handler: async (ctx, { title, rationale, tags, decisionId }) => {
    const id = decisionId ?? (await nextDecisionId(ctx));
    const docId = await ctx.db.insert("decisions", {
      decisionId: id,
      title,
      rationale,
      tags,
      createdAt: Date.now(),
    });
    return { docId, decisionId: id };
  },
});

export const update = mutation({
  args: {
    id: v.id("decisions"),
    title: v.optional(v.string()),
    rationale: v.optional(v.string()),
    tags: v.optional(v.array(v.string())),
  },
  handler: async (ctx, { id, title, rationale, tags }) => {
    const patch: Record<string, unknown> = {};
    if (title !== undefined) patch.title = title;
    if (rationale !== undefined) patch.rationale = rationale;
    if (tags !== undefined) patch.tags = tags;
    await ctx.db.patch(id, patch);
  },
});

export const remove = mutation({
  args: { id: v.id("decisions") },
  handler: async (ctx, { id }) => {
    await ctx.db.delete(id);
  },
});
