/* eslint-disable */
/**
 * Generated `api` utility.
 *
 * THIS CODE IS AUTOMATICALLY GENERATED.
 *
 * To regenerate, run `npx convex dev`.
 * @module
 */

import type * as chunks from "../chunks.js";
import type * as components_ from "../components.js";
import type * as crons from "../crons.js";
import type * as decisions from "../decisions.js";
import type * as documents from "../documents.js";
import type * as email from "../email.js";
import type * as ingest from "../ingest.js";
import type * as meetings from "../meetings.js";
import type * as memoryNotes from "../memoryNotes.js";
import type * as messages from "../messages.js";
import type * as overview from "../overview.js";
import type * as progressImages from "../progressImages.js";
import type * as rag from "../rag.js";
import type * as search from "../search.js";
import type * as tests from "../tests.js";
import type * as threads from "../threads.js";
import type * as todos from "../todos.js";

import type {
  ApiFromModules,
  FilterApi,
  FunctionReference,
} from "convex/server";

declare const fullApi: ApiFromModules<{
  chunks: typeof chunks;
  components: typeof components_;
  crons: typeof crons;
  decisions: typeof decisions;
  documents: typeof documents;
  email: typeof email;
  ingest: typeof ingest;
  meetings: typeof meetings;
  memoryNotes: typeof memoryNotes;
  messages: typeof messages;
  overview: typeof overview;
  progressImages: typeof progressImages;
  rag: typeof rag;
  search: typeof search;
  tests: typeof tests;
  threads: typeof threads;
  todos: typeof todos;
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
