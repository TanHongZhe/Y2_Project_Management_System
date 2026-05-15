import { v } from "convex/values";
import { internalMutation, internalQuery } from "./_generated/server";
import { Id } from "./_generated/dataModel";

export const insertBatch = internalMutation({
  args: {
    chunks: v.array(
      v.object({
        documentId: v.id("documents"),
        documentName: v.string(),
        text: v.string(),
        embedding: v.array(v.number()),
        chunkIndex: v.number(),
        sourceType: v.union(v.literal("text"), v.literal("image")),
        storageId: v.optional(v.id("_storage")),
        heading: v.optional(v.string()),
      }),
    ),
  },
  handler: async (ctx, { chunks }) => {
    for (const c of chunks) {
      await ctx.db.insert("chunks", c);
    }
    return chunks.length;
  },
});

export const getByIds = internalQuery({
  args: { ids: v.array(v.id("chunks")) },
  handler: async (ctx, { ids }) => {
    const out = [];
    for (const id of ids) {
      const doc = await ctx.db.get(id);
      if (doc) out.push(doc);
    }
    return out;
  },
});

export const searchByText = internalQuery({
  args: { query: v.string(), limit: v.optional(v.number()) },
  handler: async (ctx, { query, limit }) => {
    return await ctx.db
      .query("chunks")
      .withSearchIndex("search_text", (q) => q.search("text", query))
      .take(limit ?? 5);
  },
});

export const deleteByDocument = internalMutation({
  args: { documentId: v.id("documents") },
  handler: async (ctx, { documentId }) => {
    const ids: Id<"chunks">[] = [];
    let cursor: string | null = null;
    let done = false;
    while (!done) {
      const page = await ctx.db
        .query("chunks")
        .withIndex("by_document", (q) => q.eq("documentId", documentId))
        .paginate({ numItems: 100, cursor });
      for (const c of page.page) ids.push(c._id);
      done = page.isDone;
      cursor = page.continueCursor;
    }
    for (const id of ids) {
      await ctx.db.delete(id);
    }
    return ids.length;
  },
});
