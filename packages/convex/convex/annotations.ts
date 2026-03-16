import { z } from "zod";

import { ERROR_CODES, throwConvexError } from "./errors";
import { zAuthMutation, zAuthQuery, zid } from "./utils/builders";

export const addAnnotation = zAuthMutation({
  args: {
    docId: z.string(),
    type: z.enum(["bookmark", "highlight"]),
    sentenceId: z.string(),
    note: z.string().optional(),
    color: z.string().optional(),
  },
  handler: async (ctx, { docId, type, sentenceId, note, color }) => {
    const existing = await ctx.db
      .query("annotations")
      .withIndex("by_user_doc", (q) =>
        q.eq("userId", ctx.userId).eq("docId", docId),
      )
      .filter((q) =>
        q.and(
          q.eq(q.field("sentenceId"), sentenceId),
          q.eq(q.field("type"), type),
        ),
      )
      .first();

    if (existing) {
      await ctx.db.patch(existing._id, { note, color });
      return existing._id;
    }

    return ctx.db.insert("annotations", {
      userId: ctx.userId,
      docId,
      type,
      sentenceId,
      note,
      color,
    });
  },
});

export const removeAnnotation = zAuthMutation({
  args: { annotationId: zid("annotations") },
  handler: async (ctx, { annotationId }) => {
    const ann = await ctx.db.get(annotationId);
    if (!ann || ann.userId !== ctx.userId) {
      throwConvexError(ERROR_CODES.FORBIDDEN, "Not found.");
    }
    await ctx.db.delete(annotationId);
  },
});

export const updateAnnotationNote = zAuthMutation({
  args: { annotationId: zid("annotations"), note: z.string() },
  handler: async (ctx, { annotationId, note }) => {
    const ann = await ctx.db.get(annotationId);
    if (!ann || ann.userId !== ctx.userId) {
      throwConvexError(ERROR_CODES.FORBIDDEN, "Not found.");
    }
    await ctx.db.patch(annotationId, { note });
  },
});

export const listAnnotations = zAuthQuery({
  args: { docId: z.string() },
  handler: async (ctx, { docId }) => {
    return ctx.db
      .query("annotations")
      .withIndex("by_user_doc", (q) =>
        q.eq("userId", ctx.userId).eq("docId", docId),
      )
      .collect();
  },
});
