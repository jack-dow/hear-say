import { z } from "zod";

import { env } from "./env";
import { ERROR_CODES, throwConvexError } from "./errors";
import { zAuthMutation, zAuthQuery, zMutation, zid } from "./utils/builders";

const zBbox = z.object({ x1: z.number(), y1: z.number(), x2: z.number(), y2: z.number() });

const zPage = z.object({
  page: z.number(),
  text: z.string(),
  sentences: z.array(
    z.object({ id: z.string(), text: z.string(), rawText: z.string().optional(), paragraph: z.number(), bbox: zBbox.optional() }),
  ),
});

// ── Called by Python API ──────────────────────────────────────────────────────

/** Create document stub + generate upload URL. Python uploads PDF directly to uploadUrl. */
export const initUpload = zAuthMutation({
  args: { docId: z.string(), filename: z.string() },
  handler: async (ctx, { docId, filename }) => {
    const existing = await ctx.db
      .query("documents")
      .withIndex("by_user_docId", (q) =>
        q.eq("userId", ctx.userId).eq("docId", docId),
      )
      .first();

    if (existing) {
      return { documentId: existing._id, isDuplicate: true, uploadUrl: null };
    }

    const documentId = await ctx.db.insert("documents", {
      userId: ctx.userId,
      docId,
      filename,
      status: "processing",
    });

    const uploadUrl = await ctx.storage.generateUploadUrl();
    return { documentId, isDuplicate: false, uploadUrl };
  },
});

/** Validate ownership, reset status, return PDF URL + storageId for re-OCR. */
export const prepareRetry = zAuthMutation({
  args: { documentId: zid("documents") },
  handler: async (ctx, { documentId }) => {
    const doc = await ctx.db.get(documentId);
    if (!doc || doc.userId !== ctx.userId) {
      throwConvexError(ERROR_CODES.FORBIDDEN, "Not found.");
    }
    if (!doc.storageId) {
      throwConvexError(ERROR_CODES.INVALID_INPUT, "No PDF in storage.");
    }

    await ctx.db.patch(documentId, {
      status: "processing",
      retryCount: (doc.retryCount ?? 0) + 1,
      errorMessage: undefined,
    });

    const pdfUrl = await ctx.storage.getUrl(doc.storageId);
    if (!pdfUrl) throwConvexError(ERROR_CODES.NOT_FOUND, "PDF URL unavailable.");

    return { pdfUrl, storageId: doc.storageId };
  },
});

/** Set status=processing for LLM-only re-clean. Returns existing pages so Python avoids a separate fetch. */
export const prepareLlmClean = zAuthMutation({
  args: { documentId: zid("documents") },
  handler: async (ctx, { documentId }) => {
    const doc = await ctx.db.get(documentId);
    if (!doc || doc.userId !== ctx.userId) {
      throwConvexError(ERROR_CODES.FORBIDDEN, "Not found.");
    }
    if (!doc.pages?.length) {
      throwConvexError(ERROR_CODES.INVALID_INPUT, "No pages to clean.");
    }
    await ctx.db.patch(documentId, { status: "processing", processingStep: "cleaning" });
    return { pages: doc.pages };
  },
});

/** Apply LLM-cleaned pages. Authenticated with INTERNAL_SECRET, not user token. */
export const applyLlmCleaning = zMutation({
  args: {
    documentId: zid("documents"),
    pages: z.array(zPage),
    llmCleaned: z.boolean(),
    internalSecret: z.string(),
  },
  handler: async (ctx, { documentId, pages, llmCleaned, internalSecret }) => {
    if (internalSecret !== env.INTERNAL_SECRET) {
      throwConvexError(ERROR_CODES.UNAUTHORIZED, "Invalid secret.");
    }
    await ctx.db.patch(documentId, { pages, status: "ready", processingStep: undefined, llmCleaned });
  },
});

/** Save OCR result. Authenticated with INTERNAL_SECRET, not user token. */
export const completeUpload = zMutation({
  args: {
    documentId: zid("documents"),
    storageId: zid("_storage"),
    pages: z.array(zPage),
    internalSecret: z.string(),
    llmCleaned: z.boolean().optional(),
  },
  handler: async (ctx, { documentId, storageId, pages, internalSecret, llmCleaned }) => {
    if (internalSecret !== env.INTERNAL_SECRET) {
      throwConvexError(ERROR_CODES.UNAUTHORIZED, "Invalid secret.");
    }
    await ctx.db.patch(documentId, {
      storageId,
      pages,
      status: "ready",
      errorMessage: undefined,
      llmCleaned,
      processingStep: undefined,
    });
  },
});

/** Update processing step label. Authenticated with INTERNAL_SECRET, not user token. */
export const updateProcessingStep = zMutation({
  args: {
    documentId: zid("documents"),
    step: z.string(),
    internalSecret: z.string(),
  },
  handler: async (ctx, { documentId, step, internalSecret }) => {
    if (internalSecret !== env.INTERNAL_SECRET) {
      throwConvexError(ERROR_CODES.UNAUTHORIZED, "Invalid secret.");
    }
    await ctx.db.patch(documentId, { processingStep: step });
  },
});

/** Mark document as failed. Authenticated with INTERNAL_SECRET, not user token. */
export const failUpload = zMutation({
  args: {
    documentId: zid("documents"),
    errorMessage: z.string(),
    internalSecret: z.string(),
    storageId: zid("_storage").optional(),
  },
  handler: async (ctx, { documentId, errorMessage, internalSecret, storageId }) => {
    if (internalSecret !== env.INTERNAL_SECRET) {
      throwConvexError(ERROR_CODES.UNAUTHORIZED, "Invalid secret.");
    }
    await ctx.db.patch(documentId, {
      status: "error",
      errorMessage,
      processingStep: undefined,
      ...(storageId && { storageId }),
    });
  },
});

// ── Public queries/mutations ──────────────────────────────────────────────────

export const listDocuments = zAuthQuery({
  args: {},
  handler: async (ctx) => {
    return ctx.db
      .query("documents")
      .withIndex("by_user", (q) => q.eq("userId", ctx.userId))
      .order("desc")
      .collect();
  },
});

export const getPdfUrl = zAuthQuery({
  args: { docId: z.string() },
  handler: async (ctx, { docId }) => {
    const doc = await ctx.db
      .query("documents")
      .withIndex("by_user_docId", (q) =>
        q.eq("userId", ctx.userId).eq("docId", docId),
      )
      .first();
    if (!doc?.storageId) return null;
    return ctx.storage.getUrl(doc.storageId);
  },
});

export const getDocument = zAuthQuery({
  args: { docId: z.string() },
  handler: async (ctx, { docId }) => {
    return ctx.db
      .query("documents")
      .withIndex("by_user_docId", (q) =>
        q.eq("userId", ctx.userId).eq("docId", docId),
      )
      .first();
  },
});

export const savePosition = zAuthMutation({
  args: { docId: z.string(), sentenceId: z.string() },
  handler: async (ctx, { docId, sentenceId }) => {
    const existing = await ctx.db
      .query("readingPositions")
      .withIndex("by_user_doc", (q) =>
        q.eq("userId", ctx.userId).eq("docId", docId),
      )
      .first();

    if (existing) {
      await ctx.db.patch(existing._id, { sentenceId });
    } else {
      await ctx.db.insert("readingPositions", {
        userId: ctx.userId,
        docId,
        sentenceId,
      });
    }
  },
});

export const getPosition = zAuthQuery({
  args: { docId: z.string() },
  handler: async (ctx, { docId }) => {
    return ctx.db
      .query("readingPositions")
      .withIndex("by_user_doc", (q) =>
        q.eq("userId", ctx.userId).eq("docId", docId),
      )
      .first();
  },
});

export const setDocumentTags = zAuthMutation({
  args: { documentId: zid("documents"), tags: z.array(z.string()) },
  handler: async (ctx, { documentId, tags }) => {
    const doc = await ctx.db.get(documentId);
    if (!doc || doc.userId !== ctx.userId) {
      throwConvexError(ERROR_CODES.FORBIDDEN, "Not found.");
    }
    await ctx.db.patch(documentId, { tags });
  },
});

export const renameDocument = zAuthMutation({
  args: { documentId: zid("documents"), displayName: z.string() },
  handler: async (ctx, { documentId, displayName }) => {
    const doc = await ctx.db.get(documentId);
    if (!doc || doc.userId !== ctx.userId) {
      throwConvexError(ERROR_CODES.FORBIDDEN, "Not found.");
    }
    await ctx.db.patch(documentId, { displayName: displayName.trim() || undefined });
  },
});

export const deleteDocument = zAuthMutation({
  args: { documentId: zid("documents") },
  handler: async (ctx, { documentId }) => {
    const doc = await ctx.db.get(documentId);
    if (!doc || doc.userId !== ctx.userId) {
      throwConvexError(ERROR_CODES.FORBIDDEN, "Not found.");
    }
    if (doc.storageId) await ctx.storage.delete(doc.storageId);
    const pos = await ctx.db
      .query("readingPositions")
      .withIndex("by_user_doc", (q) =>
        q.eq("userId", ctx.userId).eq("docId", doc.docId),
      )
      .first();
    if (pos) await ctx.db.delete(pos._id);
    await ctx.db.delete(documentId);
  },
});
