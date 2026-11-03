import { v } from "convex/values";
import { internal } from "./_generated/api";
import { internalAction, internalQuery } from "./_generated/server";
import { SIGNATURE_HEADER, TIMESTAMP_HEADER, sign } from "./lib/hmac";

const MAX_ATTEMPTS = 5;

/**
 * Everything n8n needs to tell one person about one loan, and nothing more:
 * no user ids, no addresses, no other party's email.
 */
export const loanEventPayload = internalQuery({
  args: { loanId: v.id("loans"), recipient: v.union(v.literal("owner"), v.literal("borrower")) },
  handler: async (ctx, { loanId, recipient }) => {
    const loan = await ctx.db.get(loanId);
    if (!loan) return null;
    const [tool, person] = await Promise.all([
      ctx.db.get(loan.toolId),
      ctx.db.get(recipient === "owner" ? loan.ownerId : loan.borrowerId),
    ]);
    if (!person) return null;
    return {
      // Stable per state change, so n8n (or a retry) can drop duplicates.
      idempotencyKey: `notify:${loanId}:${loan.status}:${recipient}`,
      event: loan.status === "pending" ? "loan.requested" : "loan.status_changed",
      loanId,
      status: loan.status,
      toolName: tool?.name ?? "a tool",
      startDate: loan.startDate,
      endDate: loan.endDate,
      recipient: { role: recipient, name: person.name, email: person.email },
    };
  },
});

export const sendLoanEvent = internalAction({
  args: {
    loanId: v.id("loans"),
    recipient: v.union(v.literal("owner"), v.literal("borrower")),
    attempt: v.number(),
  },
  handler: async (ctx, args) => {
    const payload = await ctx.runQuery(internal.notify.loanEventPayload, {
      loanId: args.loanId,
      recipient: args.recipient,
    });
    if (!payload) return;

    const url = process.env.N8N_NOTIFY_WEBHOOK_URL;
    const secret = process.env.CONVEX_TO_N8N_SECRET;
    const record = (status: "sent" | "failed", detail?: string) =>
      ctx.runMutation(internal.automation.record, {
        loanId: args.loanId,
        kind: "notification",
        status,
        key: payload.idempotencyKey,
        detail,
      });

    if (!url || !secret) {
      await record("failed", "n8n webhook is not configured");
      return;
    }

    const body = JSON.stringify(payload);
    const { timestamp, signature } = await sign(secret, body);
    let error: string;
    try {
      const res = await fetch(url, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          [TIMESTAMP_HEADER]: timestamp,
          [SIGNATURE_HEADER]: signature,
        },
        body,
      });
      if (res.ok) {
        await record("sent", `Notified ${args.recipient}`);
        return;
      }
      error = `n8n responded ${res.status}`;
    } catch (e) {
      error = e instanceof Error ? e.message : "Network error";
    }

    if (args.attempt < MAX_ATTEMPTS) {
      // Exponential backoff: 10s, 20s, 40s, 80s. Each retry re-signs with a fresh timestamp.
      const delayMs = 5_000 * 2 ** args.attempt;
      await ctx.scheduler.runAfter(delayMs, internal.notify.sendLoanEvent, {
        ...args,
        attempt: args.attempt + 1,
      });
    } else {
      // Out of retries: leave a visible failure on the loan instead of failing silently.
      console.error(
        `Notification for loan ${args.loanId} failed after ${MAX_ATTEMPTS} attempts: ${error}`,
      );
      await record("failed", `Gave up after ${MAX_ATTEMPTS} attempts: ${error}`);
    }
  },
});
