import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";
import { authTables } from "@convex-dev/auth/server";

const bboxV = v.object({
  x1: v.number(),
  y1: v.number(),
  x2: v.number(),
  y2: v.number(),
});

const sentenceV = v.object({
  id: v.string(),
  text: v.string(),
  rawText: v.optional(v.string()),
  paragraph: v.number(),
  bbox: v.optional(bboxV),
});

const pageV = v.object({
  page: v.number(),
  text: v.string(),
  sentences: v.array(sentenceV),
});

export default defineSchema({
  ...authTables,

  documents: defineTable({
    userId: v.id("users"),
    storageId: v.optional(v.id("_storage")),
    filename: v.string(),
    displayName: v.optional(v.string()),
    docId: v.string(), // SHA256 of PDF bytes
    pages: v.optional(v.array(pageV)),
    status: v.union(
      v.literal("processing"),
      v.literal("ready"),
      v.literal("error"),
    ),
    errorMessage: v.optional(v.string()),
    retryCount: v.optional(v.number()),
    processingStep: v.optional(v.string()),
    tags: v.optional(v.array(v.string())), // legacy — use tagIds
    tagIds: v.optional(v.array(v.id("tags"))),
    llmCleaned: v.optional(v.boolean()),
  })
    .index("by_user", ["userId"])
    .index("by_user_docId", ["userId", "docId"]),

  tags: defineTable({
    userId: v.id("users"),
    name: v.string(),
    color: v.optional(v.string()), // key from TAG_COLORS palette
    parentId: v.optional(v.id("tags")),
  })
    .index("by_user", ["userId"])
    .index("by_user_parent", ["userId", "parentId"]),

  readingPositions: defineTable({
    userId: v.id("users"),
    docId: v.string(),
    sentenceId: v.string(),
  }).index("by_user_doc", ["userId", "docId"]),

  annotations: defineTable({
    userId: v.id("users"),
    docId: v.string(),
    type: v.union(v.literal("bookmark"), v.literal("highlight")),
    sentenceId: v.string(),
    note: v.optional(v.string()),
    color: v.optional(v.string()),
  }).index("by_user_doc", ["userId", "docId"]),
});
