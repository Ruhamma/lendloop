import { ConvexError } from "convex/values";
import type { Id } from "../_generated/dataModel";
import type { MutationCtx } from "../_generated/server";

const HOUR = 60 * 60 * 1000;

/** Per-user budgets. Generous for real neighbors, tight enough to stop scripted spam. */
export const LIMITS = {
  createTool: { max: 20, windowMs: HOUR },
  uploadPhoto: { max: 30, windowMs: HOUR },
  requestLoan: { max: 10, windowMs: HOUR },
  rate: { max: 30, windowMs: HOUR },
} as const;

/**
 * Fixed-window rate limit, stored in Convex so it holds across every client and device.
 * Mutations are transactional, so two concurrent calls can't both slip past the limit.
 */
export async function rateLimit(
  ctx: MutationCtx,
  action: keyof typeof LIMITS,
  userId: Id<"users">,
) {
  const { max, windowMs } = LIMITS[action];
  const key = `${action}:${userId}`;
  const now = Date.now();
  const bucket = await ctx.db
    .query("rateLimits")
    .withIndex("by_key", (q) => q.eq("key", key))
    .unique();

  if (!bucket || now - bucket.windowStart >= windowMs) {
    if (bucket) await ctx.db.patch(bucket._id, { windowStart: now, count: 1 });
    else await ctx.db.insert("rateLimits", { key, windowStart: now, count: 1 });
    return;
  }
  if (bucket.count >= max) {
    const minutes = Math.ceil((bucket.windowStart + windowMs - now) / 60_000);
    throw new ConvexError(`You're doing that too often. Try again in ${minutes} min.`);
  }
  await ctx.db.patch(bucket._id, { count: bucket.count + 1 });
}
