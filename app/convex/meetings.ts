import { v } from "convex/values";
import { mutation, query, internalMutation, internalQuery } from "./_generated/server";

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
    source: v.optional(v.union(v.literal("meeting"), v.literal("aria"), v.literal("note"))),
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
    editorId: v.optional(v.string()),
  },
  handler: async (ctx, { id, editorId, ...fields }) => {
    const updates: Record<string, unknown> = Object.fromEntries(
      Object.entries(fields).filter(([, val]) => val !== undefined),
    );
    if (editorId) {
      const doc = await ctx.db.get(id);
      const existing = doc?.editedBy ?? [];
      if (!existing.includes(editorId) && editorId !== doc?.createdBy) {
        updates.editedBy = [...existing, editorId];
      }
    }
    await ctx.db.patch(id, { ...updates, updatedAt: Date.now() });
  },
});

export const ariaAppend = internalMutation({
  args: {
    id: v.id("meetingNotes"),
    appendMd: v.string(),
    newSources: v.optional(v.array(v.string())),
  },
  handler: async (ctx, { id, appendMd, newSources }) => {
    const doc = await ctx.db.get(id);
    if (!doc) throw new Error("Note not found");
    const existingEditors = doc.editedBy ?? [];
    const mergedSources = newSources && newSources.length > 0
      ? [...new Set([...(doc.sources ?? []), ...newSources])]
      : doc.sources;
    await ctx.db.patch(id, {
      content: doc.content + "\n\n---\n\n" + appendMd,
      updatedAt: Date.now(),
      editedBy: existingEditors.includes("aria") ? existingEditors : [...existingEditors, "aria"],
      ...(mergedSources ? { sources: mergedSources } : {}),
    });
    return id;
  },
});

export const ariaReplace = internalMutation({
  args: {
    id: v.id("meetingNotes"),
    content: v.string(),
    title: v.optional(v.string()),
    newSources: v.optional(v.array(v.string())),
  },
  handler: async (ctx, { id, content, title, newSources }) => {
    const doc = await ctx.db.get(id);
    if (!doc) throw new Error("Note not found");
    const existingEditors = doc.editedBy ?? [];
    // Refine is destructive: the body is fully rewritten, so the source list
    // should reflect the rewrite — replace, don't preserve stale citations.
    await ctx.db.patch(id, {
      content,
      ...(title ? { title } : {}),
      updatedAt: Date.now(),
      editedBy: existingEditors.includes("aria") ? existingEditors : [...existingEditors, "aria"],
      sources: newSources && newSources.length > 0 ? newSources : [],
    });
    return id;
  },
});

export const getByIdInternal = internalQuery({
  args: { id: v.id("meetingNotes") },
  handler: async (ctx, { id }) => ctx.db.get(id),
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
