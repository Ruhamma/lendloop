import { ConvexError, v } from "convex/values";
import { internalMutation, mutation, query } from "./_generated/server";
import { getViewer, requireAdmin } from "./lib/auth";
import { audit, ratingSummary } from "./lib/history";
import { optionalText } from "./lib/text";
import { collectionArgs, searchTerm } from "./lib/collection";

/** Upsert the signed-in Clerk user. Role is never taken from the client. */
export const store = mutation({
  args: {},
  handler: async (ctx) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new ConvexError("Not signed in");

    const name = identity.name ?? identity.email ?? "Neighbor";
    const email = identity.email ?? "";
    const existing = await getViewer(ctx);
    if (existing) {
      if (existing.name !== name || existing.email !== email) {
        await ctx.db.patch(existing._id, { name, email });
      }
      return existing._id;
    }
    return await ctx.db.insert("users", {
      tokenIdentifier: identity.tokenIdentifier,
      name,
      email,
      role: "user",
      trustedLender: false,
    });
  },
});

export const me = query({
  args: {},
  handler: async (ctx) => {
    const viewer = await getViewer(ctx);
    if (!viewer) return null;
    return {
      _id: viewer._id,
      name: viewer.name,
      role: viewer.role,
      trustedLender: viewer.trustedLender,
      rating: await ratingSummary(ctx, viewer._id),
    };
  },
});

export const listForAdmin = query({
  args: {},
  handler: async (ctx) => {
    await requireAdmin(ctx);
    const users = await ctx.db.query("users").collect();
    return await Promise.all(
      users.map(async (u) => ({
        _id: u._id,
        name: u.name,
        email: u.email,
        role: u.role,
        trustedLender: u.trustedLender,
        rating: await ratingSummary(ctx, u._id),
      })),
    );
  },
});

export const setTrustedLender = mutation({
  args: { userId: v.id("users"), trusted: v.boolean(), reason: v.optional(v.string()) },
  handler: async (ctx, { userId, trusted, reason }) => {
    const admin = await requireAdmin(ctx);
    const user = await ctx.db.get(userId);
    if (!user) throw new ConvexError("User not found");
    if (user.trustedLender === trusted) return;
    await ctx.db.patch(userId, { trustedLender: trusted });
    await audit(
      ctx,
      admin._id,
      trusted ? "trusted_granted" : "trusted_revoked",
      user.name,
      optionalText(reason, "Reason", 200),
    );
  },
});

/** Admins: neighbors, searchable by name, paginated (collection query). */
export const page = query({
  args: collectionArgs,
  handler: async (ctx, args) => {
    await requireAdmin(ctx);
    const search = searchTerm(args.search);
    const result = search
      ? await ctx.db
          .query("users")
          .withSearchIndex("search_name", (q) => q.search("name", search))
          .paginate(args.paginationOpts)
      : await ctx.db
          .query("users")
          .order(args.sort === "oldest" ? "asc" : "desc")
          .paginate(args.paginationOpts);
    return {
      ...result,
      page: await Promise.all(
        result.page.map(async (u) => ({
          _id: u._id,
          name: u.name,
          email: u.email,
          role: u.role,
          trustedLender: u.trustedLender,
          rating: await ratingSummary(ctx, u._id),
        })),
      ),
    };
  },
});

/** Most recent admin actions, newest first. Admins only. */
export const auditLog = query({
  args: {},
  handler: async (ctx) => {
    await requireAdmin(ctx);
    const entries = await ctx.db.query("auditLog").order("desc").take(100);
    return await Promise.all(
      entries.map(async (e) => ({
        _id: e._id,
        at: e._creationTime,
        actorName: (await ctx.db.get(e.actorId))?.name ?? "Unknown",
        action: e.action,
        targetLabel: e.targetLabel,
        reason: e.reason ?? null,
      })),
    );
  },
});

/**
 * Promote a user to admin. Internal only, so it cannot be called from the browser:
 *   npx convex run users:makeAdmin '{"email":"you@example.com"}'
 */
export const makeAdmin = internalMutation({
  args: { email: v.string() },
  handler: async (ctx, { email }) => {
    const user = await ctx.db
      .query("users")
      .withIndex("by_email", (q) => q.eq("email", email))
      .unique();
    if (!user) throw new ConvexError(`No user with email ${email}. Sign in once first.`);
    await ctx.db.patch(user._id, { role: "admin" });
  },
});
