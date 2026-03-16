import { getAuthUserId } from "@convex-dev/auth/server";
import { NoOp } from "convex-helpers/server/customFunctions";
import { zCustomAction, zCustomMutation, zCustomQuery } from "convex-helpers/server/zod4";
import { z } from "zod";

import type { Id, TableNames } from "../_generated/dataModel";
import {
  action,
  internalAction,
  internalMutation,
  internalQuery,
  mutation,
  query,
} from "../_generated/server";
import { ERROR_CODES, throwConvexError } from "../errors";

/** Zod validator for a Convex document ID, typed as Id<T> */
export const zid = <T extends TableNames | "_storage">(tableName: T) =>
  z.custom<Id<T>>((val): val is Id<T> => typeof val === "string");

function withSkipValidation<TBuilder extends (definition: any) => any>(
  builder: TBuilder,
): TBuilder {
  return ((definition: Parameters<TBuilder>[0]) => {
    if (!definition || typeof definition !== "object") return builder(definition);
    return builder({
      ...definition,
      skipConvexValidation: definition.skipConvexValidation ?? true,
    });
  }) as TBuilder;
}

// Public — no auth required
export const zQuery = withSkipValidation(zCustomQuery(query, NoOp));
export const zMutation = withSkipValidation(zCustomMutation(mutation, NoOp));

// Authenticated — injects ctx.userId, throws UNAUTHORIZED if not signed in
export const zAuthQuery = withSkipValidation(
  zCustomQuery(query, {
    args: {},
    input: async (ctx, args) => {
      const userId = await getAuthUserId(ctx);
      if (!userId) throwConvexError(ERROR_CODES.UNAUTHORIZED, "Not authenticated.");
      return { ctx: { ...ctx, userId }, args };
    },
  }),
);

export const zAuthMutation = withSkipValidation(
  zCustomMutation(mutation, {
    args: {},
    input: async (ctx, args) => {
      const userId = await getAuthUserId(ctx);
      if (!userId) throwConvexError(ERROR_CODES.UNAUTHORIZED, "Not authenticated.");
      return { ctx: { ...ctx, userId }, args };
    },
  }),
);

// Internal — no auth, for scheduler / server-to-server calls
export const zInternalQuery = withSkipValidation(zCustomQuery(internalQuery, NoOp));
export const zInternalMutation = withSkipValidation(zCustomMutation(internalMutation, NoOp));
export const zInternalAction = withSkipValidation(zCustomAction(internalAction, NoOp));
