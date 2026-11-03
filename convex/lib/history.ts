import type { Doc, Id } from "../_generated/dataModel";
import type { MutationCtx, QueryCtx } from "../_generated/server";

type LoanEventType = Doc<"loanEvents">["type"];
type AuditAction = Doc<"auditLog">["action"];

export async function logLoanEvent(
  ctx: MutationCtx,
  loanId: Id<"loans">,
  actorId: Id<"users">,
  type: LoanEventType,
) {
  await ctx.db.insert("loanEvents", { loanId, actorId, type });
}

export async function audit(
  ctx: MutationCtx,
  actorId: Id<"users">,
  action: AuditAction,
  targetLabel: string,
  reason?: string,
) {
  await ctx.db.insert("auditLog", { actorId, action, targetLabel, reason });
}

/** Average stars a user has received, or null with no ratings yet. */
export async function ratingSummary(ctx: QueryCtx, userId: Id<"users">) {
  const ratings = await ctx.db
    .query("ratings")
    .withIndex("by_ratee", (q) => q.eq("rateeId", userId))
    .collect();
  if (ratings.length === 0) return null;
  const average = ratings.reduce((sum, r) => sum + r.stars, 0) / ratings.length;
  return { average: Math.round(average * 10) / 10, count: ratings.length };
}
