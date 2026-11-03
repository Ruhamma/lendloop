// Sends a signed (or deliberately bad) test event to the n8n notification webhook.
// Usage: node --env-file=.env.n8n scripts/sign-test.mjs [good|bad|stale]
import { createHmac } from "node:crypto";

const mode = process.argv[2] ?? "good";
const secret = process.env.CONVEX_TO_N8N_SECRET;
const body = JSON.stringify({
  idempotencyKey: `notify:test-${process.env.KEY ?? Date.now()}:pending:owner`,
  event: "loan.requested",
  loanId: "test",
  status: "pending",
  toolName: "Cordless drill",
  startDate: "2026-11-05",
  endDate: "2026-11-07",
  recipient: { role: "owner", name: "Test Owner", email: "owner@example.com" },
});
const timestamp = String(Math.floor(Date.now() / 1000) - (mode === "stale" ? 3600 : 0));
const signature = createHmac("sha256", mode === "bad" ? "wrong-secret" : secret)
  .update(`${timestamp}.${body}`)
  .digest("hex");

const res = await fetch("http://127.0.0.1:5678/webhook/lendloop-loan-event", {
  method: "POST",
  headers: {
    "Content-Type": "application/json",
    "X-LendLoop-Timestamp": timestamp,
    "X-LendLoop-Signature": signature,
  },
  body,
});
console.log(mode, res.status, await res.text());
