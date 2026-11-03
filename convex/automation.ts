import { v } from "convex/values";
import { internalMutation, internalQuery } from "./_generated/server";

/**
 * Idempotent write of an automation result. The same `key` always maps to one row:
 * a retry of a "sent" result is a no-op, and a later "sent" upgrades an earlier "failed".
 */
export const record = internalMutation({
  args: {
    loanId: v.id("loans"),
    kind: v.union(v.literal("notification"), v.literal("overdue_reminder")),
    status: v.union(v.literal("sent"), v.literal("failed")),
    key: v.string(),
    detail: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const existing = await ctx.db
      .query("automationEvents")
      .withIndex("by_key", (q) => q.eq("key", args.key))
      .unique();
    if (existing) {
      if (existing.status === "sent") return { duplicate: true };
      await ctx.db.patch(existing._id, { status: args.status, detail: args.detail });
      return { duplicate: false };
    }
    await ctx.db.insert("automationEvents", args);
    return { duplicate: false };
  },
});

export const reminderKey = (loanId: string, date: string) => `overdue:${loanId}:${date}`;

/**
 * Approved loans past their end date that have not had a reminder today.
 * Returns only what a reminder needs: tool, due date, borrower name and email.
 */
export const overdueLoans = internalQuery({
  args: { today: v.string() },
  handler: async (ctx, { today }) => {
    const loans = await ctx.db
      .query("loans")
      .withIndex("by_status_end", (q) => q.eq("status", "approved").lt("endDate", today))
      .collect();

    const result = [];
    for (const loan of loans) {
      const key = reminderKey(loan._id, today);
      const already = await ctx.db
        .query("automationEvents")
        .withIndex("by_key", (q) => q.eq("key", key))
        .unique();
      if (already?.status === "sent") continue;

      const [tool, borrower] = await Promise.all([
        ctx.db.get(loan.toolId),
        ctx.db.get(loan.borrowerId),
      ]);
      if (!borrower) continue;
      const daysOverdue = Math.round((Date.parse(today) - Date.parse(loan.endDate)) / 86_400_000);
      result.push({
        loanId: loan._id,
        reminderKey: key,
        toolName: tool?.name ?? "a tool",
        dueDate: loan.endDate,
        daysOverdue,
        borrower: { name: borrower.name, email: borrower.email },
      });
    }
    return result;
  },
});
