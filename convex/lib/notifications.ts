import { internal } from "../_generated/api";
import type { Id } from "../_generated/dataModel";
import type { MutationCtx } from "../_generated/server";

/**
 * Queue a signed webhook to n8n about a loan. Scheduled work only starts after the
 * mutation commits, so a rolled-back change never sends a notification.
 */
export async function notify(
  ctx: MutationCtx,
  loanId: Id<"loans">,
  recipient: "owner" | "borrower",
) {
  await ctx.scheduler.runAfter(0, internal.notify.sendLoanEvent, { loanId, recipient, attempt: 1 });
}
