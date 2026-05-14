import { v } from "convex/values";
import { mutation, query, internalMutation, internalQuery } from "./_generated/server";

const DocTypeValidator = v.union(
  v.literal("pdf"),
  v.literal("image"),
  v.literal("md"),
  v.literal("json"),
  v.literal("txt"),
);

const StatusValidator = v.union(
  v.literal("pending"),
  v.literal("processing"),
  v.literal("ready"),
  v.literal("error"),
);

export const generateUploadUrl = mutation({
  args: {},
  handler: async (ctx) => {
    return await ctx.storage.generateUploadUrl();
  },
});

export const create = mutation({
  args: {
    name: v.string(),
    type: DocTypeValidator,
    storageId: v.id("_storage"),
    size: v.optional(v.number()),
    group: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    return await ctx.db.insert("documents", {
      ...args,
      status: "pending",
      uploadedAt: Date.now(),
    });
  },
});

export const setStatus = internalMutation({
  args: {
    documentId: v.id("documents"),
    status: StatusValidator,
    error: v.optional(v.string()),
    chunkCount: v.optional(v.number()),
  },
  handler: async (ctx, { documentId, status, error, chunkCount }) => {
    const patch: Record<string, unknown> = { status };
    if (error !== undefined) patch.error = error;
    if (chunkCount !== undefined) patch.chunkCount = chunkCount;
    await ctx.db.patch(documentId, patch);
  },
});

export const list = query({
  args: { limit: v.optional(v.number()) },
  handler: async (ctx, { limit }) => {
    const docs = await ctx.db
      .query("documents")
      .withIndex("by_uploadedAt")
      .order("desc")
      .take(limit ?? 200);
    return docs;
  },
});

export const get = query({
  args: { documentId: v.id("documents") },
  handler: async (ctx, { documentId }) => {
    return await ctx.db.get(documentId);
  },
});

export const getInternal = internalQuery({
  args: { documentId: v.id("documents") },
  handler: async (ctx, { documentId }) => {
    return await ctx.db.get(documentId);
  },
});

export const findByName = query({
  args: { name: v.string() },
  handler: async (ctx, { name }) => {
    return await ctx.db
      .query("documents")
      .withIndex("by_name", (q) => q.eq("name", name))
      .first();
  },
});

export const findByNameInternal = internalQuery({
  args: { name: v.string() },
  handler: async (ctx, { name }) => {
    return await ctx.db
      .query("documents")
      .withIndex("by_name", (q) => q.eq("name", name))
      .first();
  },
});

export const getUrl = query({
  args: { documentId: v.id("documents") },
  handler: async (ctx, { documentId }) => {
    const doc = await ctx.db.get(documentId);
    if (!doc) return null;
    return await ctx.storage.getUrl(doc.storageId);
  },
});

export const remove = mutation({
  args: { documentId: v.id("documents") },
  handler: async (ctx, { documentId }) => {
    const doc = await ctx.db.get(documentId);
    if (!doc) return;
    let cursor: string | null = null;
    let done = false;
    while (!done) {
      const page = await ctx.db
        .query("chunks")
        .withIndex("by_document", (q) => q.eq("documentId", documentId))
        .paginate({ numItems: 100, cursor });
      for (const c of page.page) {
        await ctx.db.delete(c._id);
      }
      done = page.isDone;
      cursor = page.continueCursor;
    }
    await ctx.storage.delete(doc.storageId);
    await ctx.db.delete(documentId);
  },
});
