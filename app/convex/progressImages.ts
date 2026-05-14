import { v } from "convex/values";
import { mutation, query } from "./_generated/server";

export const generateUploadUrl = mutation({
  args: {},
  handler: async (ctx) => ctx.storage.generateUploadUrl(),
});

export const create = mutation({
  args: {
    storageId: v.id("_storage"),
    caption: v.optional(v.string()),
    category: v.optional(v.string()),
    uploadedBy: v.string(),
    size: v.optional(v.number()),
    filename: v.optional(v.string()),
    mimeType: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    return await ctx.db.insert("progressImages", {
      ...args,
      uploadedAt: Date.now(),
    });
  },
});

export const listWithUrls = query({
  args: {},
  handler: async (ctx) => {
    const images = await ctx.db
      .query("progressImages")
      .withIndex("by_uploadedAt")
      .order("desc")
      .take(500);
    return await Promise.all(
      images.map(async (img) => ({
        ...img,
        url: await ctx.storage.getUrl(img.storageId),
      })),
    );
  },
});

export const update = mutation({
  args: {
    id: v.id("progressImages"),
    caption: v.optional(v.string()),
    category: v.optional(v.string()),
  },
  handler: async (ctx, { id, caption, category }) => {
    const patch: Record<string, unknown> = {};
    if (caption !== undefined) patch.caption = caption;
    if (category !== undefined) patch.category = category;
    await ctx.db.patch(id, patch);
  },
});

export const remove = mutation({
  args: { id: v.id("progressImages") },
  handler: async (ctx, { id }) => {
    const img = await ctx.db.get(id);
    if (!img) return;
    await ctx.storage.delete(img.storageId);
    await ctx.db.delete(id);
  },
});

export const count = query({
  args: {},
  handler: async (ctx) => {
    const imgs = await ctx.db.query("progressImages").take(500);
    return imgs.length;
  },
});
