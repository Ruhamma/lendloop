import { v } from "convex/values";
import { internalMutation } from "./_generated/server";

const DAY = 24 * 60 * 60 * 1000;

/**
 * Delete uploaded files that no listing uses: abandoned uploads, rejected files, and
 * anything left behind by a failed request. Runs daily from crons.ts.
 */
export const deleteUnattachedFiles = internalMutation({
  args: { olderThanMs: v.optional(v.number()) },
  handler: async (ctx, { olderThanMs = DAY }) => {
    const cutoff = Date.now() - olderThanMs;
    const files = await ctx.db.system
      .query("_storage")
      .filter((q) => q.lte(q.field("_creationTime"), cutoff))
      .take(500);
    let deleted = 0;
    for (const file of files) {
      const usedBy = await ctx.db
        .query("tools")
        .withIndex("by_photo", (q) => q.eq("photoId", file._id))
        .first();
      if (!usedBy) {
        await ctx.storage.delete(file._id);
        deleted++;
      }
    }
    return { deleted };
  },
});
