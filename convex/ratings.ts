import { ConvexError, v } from "convex/values";
import { mutation } from "./_generated/server";
import { requireViewer } from "./lib/auth";
import { rateLimit } from "./lib/rateLimit";
import { optionalText } from "./lib/text";

const MAX_COMMENT = 280;

/**
 * Rate the other side of a finished loan. Only the two people in the loan can rate,
 * only once each, and only after the tool is back, so ratings reflect a real exchange.
 */
export const rate = mutation({
  args: { loanId: v.id("loans"), stars: v.number(), comment: v.optional(v.string()) },
  handler: async (ctx, { loanId, stars, comment }) => {
    const viewer = await requireViewer(ctx);
    await rateLimit(ctx, "rate", viewer._id);
    if (!Number.isInteger(stars) || stars < 1 || stars > 5) {
      throw new ConvexError("Rating must be 1 to 5 stars");
    }
    const loan = await ctx.db.get(loanId);
    if (!loan) throw new ConvexError("Loan not found");

    const isOwner = loan.ownerId === viewer._id;
    const isBorrower = loan.borrowerId === viewer._id;
    if (!isOwner && !isBorrower) throw new ConvexError("You can only rate loans you took part in");
    if (loan.status !== "returned") throw new ConvexError("You can rate once the tool is returned");

    const existing = await ctx.db
      .query("ratings")
      .withIndex("by_loan_rater", (q) => q.eq("loanId", loanId).eq("raterId", viewer._id))
      .unique();
    if (existing) throw new ConvexError("You already rated this loan");

    await ctx.db.insert("ratings", {
      loanId,
      raterId: viewer._id,
      rateeId: isOwner ? loan.borrowerId : loan.ownerId,
      rateeRole: isOwner ? "borrower" : "lender",
      stars,
      comment: optionalText(comment, "Comment", MAX_COMMENT),
    });
  },
});
