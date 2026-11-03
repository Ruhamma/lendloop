import { ConvexError, v } from "convex/values";
import type { Doc, Id } from "./_generated/dataModel";
import { mutation, query, type MutationCtx, type QueryCtx } from "./_generated/server";
import { isOwnerOrAdmin, requireViewer } from "./lib/auth";
import { todayIso } from "./lib/dates";
import { audit, logLoanEvent, ratingSummary } from "./lib/history";
import { notify } from "./lib/notifications";
import { rateLimit } from "./lib/rateLimit";
import { cleanText } from "./lib/text";
import { category, condition } from "./schema";

const MAX_NAME = 80;
const MAX_DESCRIPTION = 500;
const MAX_NEIGHBORHOOD = 60;
const MAX_PHOTO_BYTES = 5 * 1024 * 1024;
const PHOTO_TYPES = new Set(["image/jpeg", "image/png", "image/webp"]);

/** "on_loan" when an approved, unreturned loan has started; otherwise "available". */
async function availability(ctx: QueryCtx, tool: Doc<"tools">) {
  const today = todayIso();
  const approved = await ctx.db
    .query("loans")
    .withIndex("by_tool", (q) => q.eq("toolId", tool._id))
    .filter((q) => q.eq(q.field("status"), "approved"))
    .collect();
  const current = approved.find((l) => l.startDate <= today);
  return current
    ? { status: "on_loan" as const, until: current.endDate }
    : { status: "available" as const, until: null };
}

async function photoUrl(ctx: QueryCtx, tool: Doc<"tools">) {
  return tool.photoId ? await ctx.storage.getUrl(tool.photoId) : null;
}

/**
 * Accept an uploaded file as a tool photo only if it really is a small image and isn't
 * already attached elsewhere. The browser's checks are a convenience; this is the gate.
 */
async function validatePhoto(ctx: MutationCtx, photoId: Id<"_storage">, toolId?: Id<"tools">) {
  const file = await ctx.db.system.get(photoId);
  if (!file) throw new ConvexError("Photo upload not found. Please upload it again.");
  // Rejected files stay in storage until the daily cleanup (storage.ts): deleting here
  // would be rolled back along with the rest of this failed mutation.
  if (!file.contentType || !PHOTO_TYPES.has(file.contentType) || file.size > MAX_PHOTO_BYTES) {
    throw new ConvexError("Photos must be JPEG, PNG or WebP and at most 5 MB");
  }
  const usedBy = await ctx.db
    .query("tools")
    .withIndex("by_photo", (q) => q.eq("photoId", photoId))
    .first();
  if (usedBy && usedBy._id !== toolId)
    throw new ConvexError("That photo belongs to another listing");
}

/**
 * Public page: name and category only. No owner, photo, description or loan data,
 * so an anonymous visitor learns nothing about who lives where.
 */
export const publicList = query({
  args: {},
  handler: async (ctx) => {
    const tools = await ctx.db.query("tools").order("desc").take(100);
    const result = [];
    for (const tool of tools) {
      const { status } = await availability(ctx, tool);
      if (status === "available") {
        result.push({ _id: tool._id, name: tool.name, category: tool.category });
      }
    }
    return result;
  },
});

export const list = query({
  args: { category: v.optional(category) },
  handler: async (ctx, args) => {
    const viewer = await requireViewer(ctx);
    const tools = args.category
      ? await ctx.db
          .query("tools")
          .withIndex("by_category", (q) => q.eq("category", args.category!))
          .order("desc")
          .collect()
      : await ctx.db.query("tools").order("desc").collect();

    return await Promise.all(
      tools.map(async (tool) => {
        const owner = await ctx.db.get(tool.ownerId);
        return {
          _id: tool._id,
          name: tool.name,
          category: tool.category,
          condition: tool.condition,
          description: tool.description,
          neighborhood: tool.neighborhood ?? null,
          photoUrl: await photoUrl(ctx, tool),
          // Signed-in neighbors see the lender's display name, trust badge and rating, not their email.
          ownerName: owner?.name ?? "Unknown",
          ownerTrusted: owner?.trustedLender ?? false,
          ownerRating: await ratingSummary(ctx, tool.ownerId),
          isMine: tool.ownerId === viewer._id,
          availability: await availability(ctx, tool),
        };
      }),
    );
  },
});

/** Everything the tool detail page needs, including the dates it's already booked. */
export const get = query({
  // A plain string, because it comes straight from the URL: a malformed id is "not found", not a crash.
  args: { toolId: v.string() },
  handler: async (ctx, args) => {
    const viewer = await requireViewer(ctx);
    const toolId = ctx.db.normalizeId("tools", args.toolId);
    const tool = toolId && (await ctx.db.get(toolId));
    if (!toolId || !tool) return null;
    const owner = await ctx.db.get(tool.ownerId);
    const isMine = tool.ownerId === viewer._id;
    const today = todayIso();

    const loans = await ctx.db
      .query("loans")
      .withIndex("by_tool", (q) => q.eq("toolId", toolId))
      .collect();
    const bookings = await Promise.all(
      loans
        .filter((l) => l.status === "approved" && l.endDate >= today)
        .sort((a, b) => a.startDate.localeCompare(b.startDate))
        .map(async (l) => ({
          startDate: l.startDate,
          endDate: l.endDate,
          // Only the owner learns who booked it; other neighbors just see busy dates.
          borrowerName: isMine ? ((await ctx.db.get(l.borrowerId))?.name ?? "Unknown") : null,
        })),
    );

    return {
      _id: tool._id,
      name: tool.name,
      category: tool.category,
      condition: tool.condition,
      description: tool.description,
      neighborhood: tool.neighborhood ?? null,
      photoUrl: await photoUrl(ctx, tool),
      ownerName: owner?.name ?? "Unknown",
      ownerTrusted: owner?.trustedLender ?? false,
      ownerRating: await ratingSummary(ctx, tool.ownerId),
      isMine,
      availability: await availability(ctx, tool),
      bookings,
      hasPendingRequest: loans.some((l) => l.borrowerId === viewer._id && l.status === "pending"),
    };
  },
});

export const mine = query({
  args: {},
  handler: async (ctx) => {
    const viewer = await requireViewer(ctx);
    const tools = await ctx.db
      .query("tools")
      .withIndex("by_owner", (q) => q.eq("ownerId", viewer._id))
      .order("desc")
      .collect();
    return await Promise.all(
      tools.map(async (tool) => ({
        ...tool,
        photoUrl: await photoUrl(ctx, tool),
        availability: await availability(ctx, tool),
      })),
    );
  },
});

/** Short-lived URL the browser uploads a photo to. The file is checked when it's attached. */
export const generateUploadUrl = mutation({
  args: {},
  handler: async (ctx) => {
    const viewer = await requireViewer(ctx);
    await rateLimit(ctx, "uploadPhoto", viewer._id);
    return await ctx.storage.generateUploadUrl();
  },
});

const toolFields = {
  name: v.string(),
  neighborhood: v.string(),
  category,
  condition,
  description: v.string(),
  photoId: v.optional(v.id("_storage")),
};

export const create = mutation({
  args: toolFields,
  handler: async (ctx, args) => {
    const viewer = await requireViewer(ctx);
    await rateLimit(ctx, "createTool", viewer._id);
    if (args.photoId) await validatePhoto(ctx, args.photoId);
    return await ctx.db.insert("tools", {
      ownerId: viewer._id,
      name: cleanText(args.name, "Name", MAX_NAME),
      category: args.category,
      condition: args.condition,
      description: cleanText(args.description, "Description", MAX_DESCRIPTION),
      photoId: args.photoId,
      neighborhood: cleanText(args.neighborhood, "Neighborhood", MAX_NEIGHBORHOOD),
    });
  },
});

export const update = mutation({
  args: { toolId: v.id("tools"), ...toolFields },
  handler: async (ctx, { toolId, ...fields }) => {
    const viewer = await requireViewer(ctx);
    const tool = await ctx.db.get(toolId);
    if (!tool) throw new ConvexError("Tool not found");
    // Users edit only their own listings. Admins may remove listings but not rewrite them.
    if (tool.ownerId !== viewer._id) throw new ConvexError("You can only edit your own listings");
    if (fields.photoId && fields.photoId !== tool.photoId) {
      await validatePhoto(ctx, fields.photoId, toolId);
    }
    await ctx.db.patch(toolId, {
      name: cleanText(fields.name, "Name", MAX_NAME),
      category: fields.category,
      condition: fields.condition,
      description: cleanText(fields.description, "Description", MAX_DESCRIPTION),
      photoId: fields.photoId,
      neighborhood: cleanText(fields.neighborhood, "Neighborhood", MAX_NEIGHBORHOOD),
    });
    // Replaced or removed photos are deleted rather than left orphaned in storage.
    if (tool.photoId && tool.photoId !== fields.photoId) await ctx.storage.delete(tool.photoId);
  },
});

export const remove = mutation({
  args: { toolId: v.id("tools"), reason: v.optional(v.string()) },
  handler: async (ctx, { toolId, reason }) => {
    const viewer = await requireViewer(ctx);
    const tool = await ctx.db.get(toolId);
    if (!tool) throw new ConvexError("Tool not found");
    if (!isOwnerOrAdmin(viewer, tool.ownerId)) {
      throw new ConvexError("You can only delete your own listings");
    }
    const moderating = tool.ownerId !== viewer._id;
    const why = moderating ? cleanText(reason ?? "", "A reason", 200) : undefined;

    const loans = await ctx.db
      .query("loans")
      .withIndex("by_tool", (q) => q.eq("toolId", toolId))
      .collect();
    if (!moderating && loans.some((l) => l.status === "approved")) {
      throw new ConvexError("This tool is lent out or booked. Mark it returned first.");
    }
    // Open requests can never be fulfilled once the listing is gone.
    for (const loan of loans) {
      if (loan.status === "pending" || loan.status === "approved") {
        await ctx.db.patch(loan._id, { status: "cancelled", pickup: undefined });
        await logLoanEvent(ctx, loan._id, viewer._id, "listing_removed");
        await notify(ctx, loan._id, "borrower");
      }
    }
    if (moderating) {
      const owner = await ctx.db.get(tool.ownerId);
      await audit(
        ctx,
        viewer._id,
        "listing_removed",
        `"${tool.name}" by ${owner?.name ?? "unknown"}`,
        why,
      );
    }
    if (tool.photoId) await ctx.storage.delete(tool.photoId);
    await ctx.db.delete(toolId);
  },
});
