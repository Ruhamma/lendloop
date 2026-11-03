import { httpRouter } from "convex/server";
import { internal } from "./_generated/api";
import type { Id } from "./_generated/dataModel";
import { httpAction } from "./_generated/server";
import { reminderKey } from "./automation";
import { todayIso } from "./lib/dates";
import { SIGNATURE_HEADER, TIMESTAMP_HEADER, verify } from "./lib/hmac";

const http = httpRouter();

const json = (data: unknown, status = 200) =>
  new Response(JSON.stringify(data), { status, headers: { "Content-Type": "application/json" } });

/** Read the raw body and check its HMAC before anything else touches it. */
async function verified(request: Request): Promise<{ body: string } | Response> {
  const secret = process.env.N8N_TO_CONVEX_SECRET;
  if (!secret) return json({ error: "Integration not configured" }, 503);
  const body = await request.text();
  const ok = await verify(
    secret,
    body,
    request.headers.get(TIMESTAMP_HEADER),
    request.headers.get(SIGNATURE_HEADER),
  );
  // Same response for every failure, so a caller can't probe which check failed.
  return ok ? { body } : json({ error: "Unauthorized" }, 401);
}

http.route({
  path: "/n8n/overdue-loans",
  method: "GET",
  handler: httpAction(async (ctx, request) => {
    const check = await verified(request);
    if (check instanceof Response) return check;
    const today = todayIso();
    const loans = await ctx.runQuery(internal.automation.overdueLoans, { today });
    return json({ today, loans });
  }),
});

http.route({
  path: "/n8n/reminder-status",
  method: "POST",
  handler: httpAction(async (ctx, request) => {
    const check = await verified(request);
    if (check instanceof Response) return check;

    let input: { loanId?: unknown; reminderKey?: unknown; status?: unknown; detail?: unknown };
    try {
      input = JSON.parse(check.body);
    } catch {
      return json({ error: "Invalid JSON" }, 400);
    }
    const { loanId, status, detail } = input;
    if (typeof loanId !== "string" || (status !== "sent" && status !== "failed")) {
      return json({ error: "loanId and status (sent|failed) are required" }, 400);
    }
    // The key is derived on our side from the loan id and its date, so n8n can't
    // write arbitrary keys; it can only confirm reminders we handed out.
    const key = typeof input.reminderKey === "string" ? input.reminderKey : "";
    const date = key.split(":")[2] ?? "";
    if (
      key !== reminderKey(loanId, date) ||
      !/^\d{4}-\d{2}-\d{2}$/.test(date) ||
      date > todayIso()
    ) {
      return json({ error: "Invalid reminderKey" }, 400);
    }

    try {
      const result = await ctx.runMutation(internal.automation.record, {
        loanId: loanId as Id<"loans">,
        kind: "overdue_reminder",
        status,
        key,
        detail: typeof detail === "string" ? detail.slice(0, 200) : undefined,
      });
      return json({ ok: true, ...result });
    } catch {
      return json({ error: "Unknown loan" }, 400);
    }
  }),
});

export default http;
