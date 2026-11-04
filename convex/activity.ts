import { v } from "convex/values";
import type { Id } from "./_generated/dataModel";
import { query } from "./_generated/server";
import { requireAdmin } from "./lib/auth";

const KINDS = v.union(
  v.literal("all"),
  v.literal("admin"),
  v.literal("loan"),
  v.literal("automation"),
);

/**
 * Admin-only general audit log: admin actions, every loan state change and every automation
 * result, merged newest first and paged by offset. Each source is read newest-first up to
 * offset + pageSize, which is exactly enough to fill the requested page of the merged list.
 */
export const feed = query({
  args: { kind: KINDS, offset: v.number(), pageSize: v.number() },
  handler: async (ctx, { kind, offset, pageSize }) => {
    await requireAdmin(ctx);
    const size = Math.min(Math.max(pageSize, 1), 100);
    const start = Math.max(offset, 0);
    // Reading start + size from each source, newest first, is enough to fill this page exactly.
    const n = Math.min(start + size + 1, 2000);
    const name = async (id: Id<"users">) => (await ctx.db.get(id))?.name ?? "Unknown";
    const toolName = async (loanId: Id<"loans">) => {
      const loan = await ctx.db.get(loanId);
      const tool = loan && (await ctx.db.get(loan.toolId));
      return tool?.name ?? "Removed tool";
    };

    const entries: {
      id: string;
      at: number;
      kind: "admin" | "loan" | "automation";
      actor: string;
      action: string;
      target: string;
      detail: string | null;
      ok: boolean;
    }[] = [];

    if (kind === "all" || kind === "admin") {
      for (const e of await ctx.db.query("auditLog").order("desc").take(n)) {
        entries.push({
          id: e._id,
          at: e._creationTime,
          kind: "admin",
          actor: await name(e.actorId),
          action: e.action.replace(/_/g, " "),
          target: e.targetLabel,
          detail: e.reason ?? null,
          ok: true,
        });
      }
    }
    if (kind === "all" || kind === "loan") {
      for (const e of await ctx.db.query("loanEvents").order("desc").take(n)) {
        entries.push({
          id: e._id,
          at: e._creationTime,
          kind: "loan",
          actor: await name(e.actorId),
          action: e.type.replace(/_/g, " "),
          target: await toolName(e.loanId),
          detail: null,
          ok: true,
        });
      }
    }
    if (kind === "all" || kind === "automation") {
      for (const e of await ctx.db.query("automationEvents").order("desc").take(n)) {
        entries.push({
          id: e._id,
          at: e._creationTime,
          kind: "automation",
          actor: "n8n",
          action: e.kind === "overdue_reminder" ? "overdue reminder" : "notification",
          target: await toolName(e.loanId),
          detail: e.detail ?? null,
          ok: e.status === "sent",
        });
      }
    }
    const sorted = entries.sort((a, b) => b.at - a.at);
    return {
      entries: sorted.slice(start, start + size),
      hasMore: sorted.length > start + size,
    };
  },
});
