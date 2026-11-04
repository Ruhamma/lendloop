import { paginationOptsValidator } from "convex/server";
import { v } from "convex/values";

/**
 * "Collection query": every list in the app takes the same shape of arguments, so the
 * client can drive search, filters, sorting and paging with one generic hook
 * (app/dashboard/collection.tsx). Each list declares which filters it understands.
 */
export const collectionArgs = {
  search: v.optional(v.string()),
  sort: v.optional(v.union(v.literal("newest"), v.literal("oldest"), v.literal("name"))),
  paginationOpts: paginationOptsValidator,
};

/** Trimmed search text, or undefined when empty, capped so a huge string can't be sent. */
export function searchTerm(search: string | undefined) {
  const s = search?.trim().slice(0, 100);
  return s ? s : undefined;
}
