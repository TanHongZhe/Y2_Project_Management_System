import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

export default defineSchema({
  documents: defineTable({
    name: v.string(),
    type: v.union(
      v.literal("pdf"),
      v.literal("image"),
      v.literal("md"),
      v.literal("json"),
      v.literal("txt"),
    ),
    storageId: v.id("_storage"),
    size: v.optional(v.number()),
    group: v.optional(v.string()),
    status: v.union(
      v.literal("pending"),
      v.literal("processing"),
      v.literal("ready"),
      v.literal("error"),
    ),
    error: v.optional(v.string()),
    chunkCount: v.optional(v.number()),
    uploadedAt: v.number(),
  })
    .index("by_uploadedAt", ["uploadedAt"])
    .index("by_name", ["name"])
    .index("by_status", ["status"]),

  chunks: defineTable({
    documentId: v.id("documents"),
    documentName: v.string(),
    text: v.string(),
    embedding: v.array(v.number()),
    chunkIndex: v.number(),
    sourceType: v.union(v.literal("text"), v.literal("image")),
    storageId: v.optional(v.id("_storage")),
    heading: v.optional(v.string()),
  })
    .index("by_document", ["documentId", "chunkIndex"])
    .vectorIndex("by_embedding", {
      vectorField: "embedding",
      dimensions: 1536,
    }),

  memoryNotes: defineTable({
    section: v.string(),
    content: v.string(),
    updatedAt: v.number(),
    author: v.string(),
  }).index("by_section", ["section"]),

  progressImages: defineTable({
    storageId: v.id("_storage"),
    caption: v.optional(v.string()),
    category: v.optional(v.string()),
    uploadedBy: v.string(),
    uploadedAt: v.number(),
    size: v.optional(v.number()),
    filename: v.optional(v.string()),
    mimeType: v.optional(v.string()),
  })
    .index("by_uploadedAt", ["uploadedAt"])
    .index("by_category", ["category"]),

  decisions: defineTable({
    decisionId: v.string(),
    title: v.string(),
    rationale: v.string(),
    tags: v.array(v.string()),
    createdAt: v.number(),
  })
    .index("by_decisionId", ["decisionId"])
    .index("by_createdAt", ["createdAt"]),

  components: defineTable({
    ref: v.string(),
    name: v.string(),
    qty: v.number(),
    unit: v.optional(v.string()),
    estCost: v.number(),
    status: v.union(
      v.literal("planned"),
      v.literal("ordered"),
      v.literal("received"),
      v.literal("installed"),
    ),
    supplier: v.optional(v.string()),
    model: v.optional(v.string()),
    specs: v.optional(v.string()),
    notes: v.optional(v.string()),
    tags: v.array(v.string()),
    datasheetId: v.optional(v.id("documents")),
    createdAt: v.number(),
  })
    .index("by_ref", ["ref"])
    .index("by_status", ["status"]),

  tests: defineTable({
    testId: v.string(),
    title: v.string(),
    subsystem: v.string(),
    result: v.union(
      v.literal("pass"),
      v.literal("fail"),
      v.literal("pending"),
    ),
    metrics: v.array(
      v.object({
        key: v.string(),
        value: v.string(),
        unit: v.optional(v.string()),
      }),
    ),
    conditions: v.optional(v.string()),
    notes: v.optional(v.string()),
    testedAt: v.number(),
    author: v.string(),
  })
    .index("by_testId", ["testId"])
    .index("by_subsystem", ["subsystem"])
    .index("by_testedAt", ["testedAt"]),

  todos: defineTable({
    text: v.string(),
    done: v.boolean(),
    assignedTo: v.array(v.string()),
    dueDate: v.optional(v.number()),
    important: v.optional(v.boolean()),
    createdAt: v.number(),
  }).index("by_createdAt", ["createdAt"]),

  threads: defineTable({
    title: v.string(),
    createdAt: v.number(),
    lastMessageAt: v.optional(v.number()),
    userId: v.optional(v.string()),
  })
    .index("by_lastMessageAt", ["lastMessageAt"])
    .index("by_userId_lastMessageAt", ["userId", "lastMessageAt"]),

  messages: defineTable({
    threadId: v.id("threads"),
    role: v.union(
      v.literal("user"),
      v.literal("assistant"),
      v.literal("system"),
    ),
    content: v.string(),
    model: v.optional(v.string()),
    toolCalls: v.optional(
      v.array(
        v.object({
          name: v.string(),
          args: v.string(),
          status: v.union(
            v.literal("pending"),
            v.literal("applied"),
            v.literal("error"),
          ),
          result: v.optional(v.string()),
        }),
      ),
    ),
    citations: v.optional(
      v.array(
        v.object({
          file: v.string(),
          section: v.optional(v.string()),
          url: v.optional(v.string()),
        }),
      ),
    ),
    createdAt: v.number(),
  }).index("by_thread", ["threadId", "createdAt"]),
});
