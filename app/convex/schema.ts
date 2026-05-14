import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

export default defineSchema({
  messages: defineTable({
    role: v.union(v.literal("user"), v.literal("assistant"), v.literal("system")),
    content: v.string(),
    model: v.optional(v.string()),
    threadId: v.string(),
    createdAt: v.number(),
  }).index("by_thread", ["threadId", "createdAt"]),

  decisions: defineTable({
    decisionId: v.string(),
    title: v.string(),
    rationale: v.string(),
    tags: v.array(v.string()),
    createdAt: v.number(),
  }).index("by_decisionId", ["decisionId"]),

  memoryNotes: defineTable({
    section: v.string(),
    content: v.string(),
    updatedAt: v.number(),
    author: v.string(),
  }).index("by_section", ["section"]),
});
