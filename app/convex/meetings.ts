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
  handler: async (ctx, { id }) => {
    const doc = await ctx.db.get(id);
    if (doc?.audioStorageId) {
      await ctx.storage.delete(doc.audioStorageId);
    }
    await ctx.db.delete(id);
  },
});

export const generateAudioUploadUrl = mutation({
  args: {},
  handler: async (ctx) => ctx.storage.generateUploadUrl(),
});

export const saveAudio = mutation({
  args: { id: v.id("meetingNotes"), audioStorageId: v.id("_storage") },
  handler: async (ctx, { id, audioStorageId }) => {
    const doc = await ctx.db.get(id);
    if (doc?.audioStorageId) {
      // Defensive: one recording per meeting. Caller should already enforce
      // this client-side; if a stale upload races in, drop the new blob and
      // keep the existing recording rather than silently replacing it.
      await ctx.storage.delete(audioStorageId);
      return;
    }
    await ctx.db.patch(id, { audioStorageId, updatedAt: Date.now() });
  },
});

export const deleteAudio = mutation({
  args: { id: v.id("meetingNotes") },
  handler: async (ctx, { id }) => {
    const doc = await ctx.db.get(id);
    if (!doc?.audioStorageId) return;
    await ctx.storage.delete(doc.audioStorageId);
    await ctx.db.patch(id, { audioStorageId: undefined, updatedAt: Date.now() });
  },
});

export const getAudioUrl = query({
  args: { storageId: v.id("_storage") },
  handler: async (ctx, { storageId }) => ctx.storage.getUrl(storageId),
});
