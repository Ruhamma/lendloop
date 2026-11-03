import { ConvexError, v } from "convex/values";
import type { Doc, Id } from "./_generated/dataModel";
import { mutation, query, type QueryCtx } from "./_generated/server";
import { requireAdmin, requireViewer } from "./lib/auth";
import { assertIsoDate, rangesOverlap, todayIso } from "./lib/dates";
import { logLoanEvent } from "./lib/history";
import { notify } from "./lib/notifications";
import { rateLimit } from "./lib/rateLimit";
import { cleanText, optionalText } from "./lib/text";

const MAX_LOAN_DAYS = 30;
const MAX_NOTE = 280;
const MAX_PICKUP = 300;

const pickupArg = v.object({
  kind: v.union(v.literal("home"), v.literal("meetup")),
  details: v.string(),
});

function cleanPickup(pickup: { kind: "home" | "meetup"; details: string }) {
  return { kind: pickup.kind, details: cleanText(pickup.details, "Pickup details", MAX_PICKUP) };
}

async function loadLoan(ctx: QueryCtx, loanId: Id<"loans">) {
  const loan = await ctx.db.get(loanId);
  if (!loan) throw new ConvexError("Request not found");
  return loan;
}

/** People's actions and automation results for one loan, oldest first. */
async function timeline(ctx: QueryCtx, loanId: Id<"loans">) {
  const [actions, automations] = await Promise.all([
    ctx.db
      .query("loanEvents")
      .withIndex("by_loan", (q) => q.eq("loanId", loanId))
      .collect(),
    ctx.db
      .query("automationEvents")
      .withIndex("by_loan", (q) => q.eq("loanId", loanId))
      .collect(),
  ]);
  const entries = [
    ...(await Promise.all(
      actions.map(async (e) => ({
        at: e._creationTime,
        kind: "action" as const,
        type: e.type,
        actorName: (await ctx.db.get(e.actorId))?.name ?? "Someone",
      })),
    )),
    ...automations.map((e) => ({
      at: e._creationTime,
      kind: "automation" as const,
      type: e.kind,
      status: e.status,
    })),
  ];
  return entries.sort((a, b) => a.at - b.at);
}

/** Shape a loan for the UI with only the fields the viewer's side needs. */
async function present(ctx: QueryCtx, loan: Doc<"loans">, viewerId: Id<"users">) {
  const [tool, owner, borrower, myRating] = await Promise.all([
    ctx.db.get(loan.toolId),
    ctx.db.get(loan.ownerId),
    ctx.db.get(loan.borrowerId),
    ctx.db
      .query("ratings")
      .withIndex("by_loan_rater", (q) => q.eq("loanId", loan._id).eq("raterId", viewerId))
      .unique(),
  ]);
  const events = await timeline(ctx, loan._id);
  const lastAutomation = events.findLast((e) => e.kind === "automation");
  const isParty = viewerId === loan.ownerId || viewerId === loan.borrowerId;
  // Staged disclosure: the owner always sees what they wrote; the borrower sees it only
  // once approved and while the loan is active; nobody else (admins included) ever does.
  const showPickup =
    viewerId === loan.ownerId || (viewerId === loan.borrowerId && loan.status === "approved");
  return {
    _id: loan._id,
    _creationTime: loan._creationTime,
    toolId: loan.toolId,
    toolName: tool?.name ?? "Removed tool",
    ownerName: owner?.name ?? "Unknown",
    borrowerName: borrower?.name ?? "Unknown",
    startDate: loan.startDate,
    endDate: loan.endDate,
    status: loan.status,
    note: loan.note ?? null,
    pickup: showPickup ? (loan.pickup ?? null) : null,
    overdue: loan.status === "approved" && loan.endDate < todayIso(),
    lastAutomation:
      lastAutomation?.kind === "automation"
        ? { kind: lastAutomation.type, status: lastAutomation.status, at: lastAutomation.at }
        : null,
    timeline: events,
    // Each side may rate the other once, after the tool is back.
    canRate: isParty && loan.status === "returned" && !myRating,
    myRating: myRating?.stars ?? null,
  };
}

export const request = mutation({
  args: {
    toolId: v.id("tools"),
    startDate: v.string(),
    endDate: v.string(),
    note: v.optional(v.string()),
  },
  handler: async (ctx, { toolId, startDate, endDate, note }) => {
    const viewer = await requireViewer(ctx);
    await rateLimit(ctx, "requestLoan", viewer._id);
    assertIsoDate(startDate, "Start date");
    assertIsoDate(endDate, "End date");
    if (startDate < todayIso()) throw new ConvexError("Start date can't be in the past");
    if (endDate < startDate) throw new ConvexError("End date must be on or after the start date");
    const days = (Date.parse(endDate) - Date.parse(startDate)) / 86_400_000 + 1;
    if (days > MAX_LOAN_DAYS) throw new ConvexError(`Loans are limited to ${MAX_LOAN_DAYS} days`);

    const tool = await ctx.db.get(toolId);
    if (!tool) throw new ConvexError("Tool not found");
    if (tool.ownerId === viewer._id) throw new ConvexError("You can't borrow your own tool");

    const existing = await ctx.db
      .query("loans")
      .withIndex("by_tool", (q) => q.eq("toolId", toolId))
      .collect();
    if (existing.some((l) => l.borrowerId === viewer._id && l.status === "pending")) {
      throw new ConvexError("You already have a pending request for this tool");
    }
    if (
      existing.some(
        (l) => l.status === "approved" && rangesOverlap(l.startDate, l.endDate, startDate, endDate),
      )
    ) {
      throw new ConvexError("The tool is already booked for some of those dates");
    }

    const loanId = await ctx.db.insert("loans", {
      toolId,
      ownerId: tool.ownerId,
      borrowerId: viewer._id,
      startDate,
      endDate,
      status: "pending",
      note: optionalText(note, "Note", MAX_NOTE),
    });
    await logLoanEvent(ctx, loanId, viewer._id, "requested");
    await notify(ctx, loanId, "owner");
    return loanId;
  },
});

/** Owner decides on a pending request for their own tool. */
export const decide = mutation({
  args: { loanId: v.id("loans"), approve: v.boolean(), pickup: v.optional(pickupArg) },
  handler: async (ctx, { loanId, approve, pickup }) => {
    const viewer = await requireViewer(ctx);
    const loan = await loadLoan(ctx, loanId);
    if (loan.ownerId !== viewer._id) throw new ConvexError("Only the tool's owner can decide");
    if (loan.status !== "pending") throw new ConvexError("This request was already handled");

    if (approve) {
      const clash = await ctx.db
        .query("loans")
        .withIndex("by_tool", (q) => q.eq("toolId", loan.toolId))
        .filter((q) => q.eq(q.field("status"), "approved"))
        .collect();
      if (clash.some((l) => rangesOverlap(l.startDate, l.endDate, loan.startDate, loan.endDate))) {
        throw new ConvexError("Those dates overlap a loan you already approved");
      }
    }
    if (approve && !pickup)
      throw new ConvexError("Add pickup details so the borrower knows where to go");
    await ctx.db.patch(
      loanId,
      approve ? { status: "approved", pickup: cleanPickup(pickup!) } : { status: "declined" },
    );
    await logLoanEvent(ctx, loanId, viewer._id, approve ? "approved" : "declined");
    await notify(ctx, loanId, "borrower");
  },
});

/** Borrower withdraws their own pending request. */
export const cancel = mutation({
  args: { loanId: v.id("loans") },
  handler: async (ctx, { loanId }) => {
    const viewer = await requireViewer(ctx);
    const loan = await loadLoan(ctx, loanId);
    if (loan.borrowerId !== viewer._id)
      throw new ConvexError("You can only cancel your own requests");
    if (loan.status !== "pending") throw new ConvexError("Only pending requests can be cancelled");
    await ctx.db.patch(loanId, { status: "cancelled" });
    await logLoanEvent(ctx, loanId, viewer._id, "cancelled");
    await notify(ctx, loanId, "owner");
  },
});

/** Owner confirms the tool came back. Only the lender can say they have it again. */
export const markReturned = mutation({
  args: { loanId: v.id("loans") },
  handler: async (ctx, { loanId }) => {
    const viewer = await requireViewer(ctx);
    const loan = await loadLoan(ctx, loanId);
    if (loan.ownerId !== viewer._id)
      throw new ConvexError("Only the tool's owner can mark it returned");
    if (loan.status !== "approved") throw new ConvexError("Only active loans can be returned");
    // The handover is over, so the pickup location is deleted rather than kept around.
    await ctx.db.patch(loanId, { status: "returned", returnedAt: Date.now(), pickup: undefined });
    await logLoanEvent(ctx, loanId, viewer._id, "returned");
    await notify(ctx, loanId, "borrower");
  },
});

/** Owner changes where or when to collect an active loan's tool. */
export const updatePickup = mutation({
  args: { loanId: v.id("loans"), pickup: pickupArg },
  handler: async (ctx, { loanId, pickup }) => {
    const viewer = await requireViewer(ctx);
    const loan = await loadLoan(ctx, loanId);
    if (loan.ownerId !== viewer._id)
      throw new ConvexError("Only the tool's owner can change pickup details");
    if (loan.status !== "approved")
      throw new ConvexError("Pickup details only apply to active loans");
    await ctx.db.patch(loanId, { pickup: cleanPickup(pickup) });
  },
});

export const myRequests = query({
  args: {},
  handler: async (ctx) => {
    const viewer = await requireViewer(ctx);
    const loans = await ctx.db
      .query("loans")
      .withIndex("by_borrower", (q) => q.eq("borrowerId", viewer._id))
      .order("desc")
      .collect();
    return await Promise.all(loans.map((l) => present(ctx, l, viewer._id)));
  },
});

export const incoming = query({
  args: {},
  handler: async (ctx) => {
    const viewer = await requireViewer(ctx);
    const loans = await ctx.db
      .query("loans")
      .withIndex("by_owner", (q) => q.eq("ownerId", viewer._id))
      .order("desc")
      .collect();
    return await Promise.all(loans.map((l) => present(ctx, l, viewer._id)));
  },
});

export const all = query({
  args: {},
  handler: async (ctx) => {
    const admin = await requireAdmin(ctx);
    const loans = await ctx.db.query("loans").order("desc").take(200);
    return await Promise.all(loans.map((l) => present(ctx, l, admin._id)));
  },
});
