/* eslint-disable */
/**
 * Generated `api` utility.
 *
 * THIS CODE IS AUTOMATICALLY GENERATED.
 *
 * To regenerate, run `npx convex dev`.
 * @module
 */

import type * as annotations from "../annotations.js";
import type * as auth from "../auth.js";
import type * as documents from "../documents.js";
import type * as env from "../env.js";
import type * as errors from "../errors.js";
import type * as http from "../http.js";
import type * as tags from "../tags.js";
import type * as users from "../users.js";
import type * as utils_builders from "../utils/builders.js";

import type {
  ApiFromModules,
  FilterApi,
  FunctionReference,
} from "convex/server";

declare const fullApi: ApiFromModules<{
  annotations: typeof annotations;
  auth: typeof auth;
  documents: typeof documents;
  env: typeof env;
  errors: typeof errors;
  http: typeof http;
  tags: typeof tags;
  users: typeof users;
  "utils/builders": typeof utils_builders;
}>;

/**
 * A utility for referencing Convex functions in your app's public API.
 *
 * Usage:
 * ```js
 * const myFunctionReference = api.myModule.myFunction;
 * ```
 */
export declare const api: FilterApi<
  typeof fullApi,
  FunctionReference<any, "public">
>;

/**
 * A utility for referencing Convex functions in your app's internal API.
 *
 * Usage:
 * ```js
 * const myFunctionReference = internal.myModule.myFunction;
 * ```
 */
export declare const internal: FilterApi<
  typeof fullApi,
  FunctionReference<any, "internal">
>;

export declare const components: {};
