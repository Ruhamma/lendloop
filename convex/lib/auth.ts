import { ConvexError } from "convex/values";
import type { Doc, Id } from "../_generated/dataModel";
import type { QueryCtx } from "../_generated/server";

// Every authorization decision runs through these helpers, inside Convex functions.
// The UI hides buttons for convenience only; it is never the security boundary.

export async function getViewer(ctx: QueryCtx): Promise<Doc<"users"> | null> {
  const identity = await ctx.auth.getUserIdentity();
  if (!identity) return null;
  return await ctx.db
    .query("users")
    .withIndex("by_token", (q) => q.eq("tokenIdentifier", identity.tokenIdentifier))
    .unique();
}

export async function requireViewer(ctx: QueryCtx): Promise<Doc<"users">> {
  const viewer = await getViewer(ctx);
  if (!viewer) throw new ConvexError("Not signed in");
  return viewer;
}

export async function requireAdmin(ctx: QueryCtx): Promise<Doc<"users">> {
  const viewer = await requireViewer(ctx);
  if (viewer.role !== "admin") throw new ConvexError("Admins only");
  return viewer;
}

export function isOwnerOrAdmin(viewer: Doc<"users">, ownerId: Id<"users">) {
  return viewer.role === "admin" || viewer._id === ownerId;
}
