# Production considerations

LendLoop is a take-home: it runs locally with Convex, Clerk dev keys and a self-hosted n8n. This document is the plan for running it as a real service, with an AWS deployment in mind. For each item: what exists today, what I'd change, and why.

---

## 1. Identity and access lifecycle

**Today:** Clerk handles sign-in; Convex verifies Clerk JWTs and stores a `role` per user. Admin is granted only through an internal Convex function (`users:makeAdmin`), never from the browser.

**In production:**
- **Roles come from the identity provider, not a CLI.** Store roles in Clerk organization roles or public metadata and sync them to Convex through **Clerk webhooks** (`user.updated`, `organizationMembership.*`). For enterprise customers, accept **SCIM** provisioning from their IdP (Okta, Entra ID) so joiners, movers and leavers are handled by their HR system.
- **Real-time de-provisioning.** On `user.deleted` / SCIM deactivate, revoke sessions in Clerk and mark the Convex user inactive in the same webhook handler, so access ends in seconds, not at token expiry.
- **MFA for privileged actions.** Require MFA for every admin account (Clerk can enforce it per role), and use Clerk's step-up verification (reverification) before sensitive mutations: removing a listing, granting Trusted Lender, changing roles.
- **Webhook security** follows the same pattern already used for n8n: verify the signature (Svix for Clerk), reject stale timestamps, and process each event idempotently by event ID.

## 2. Audit logging and tamper evidence

**Today:** an append-only `auditLog` table records every admin action with actor, time and reason, and `loanEvents` records every loan state change. Nothing in the app can edit or delete them. But a database admin could.

**In production:**
- **Stream every audit and state-change event to immutable storage**: Amazon **S3 with Object Lock (compliance mode)** and a retention period, or CloudWatch Logs with a retention policy. Once written, records can't be altered or deleted, even by account admins.
- **Hash-chain the entries** (each record stores the hash of the previous one) so gaps or edits are detectable when exporting or reviewing.
- **AWS CloudTrail** for the infrastructure side: who changed IAM, secrets, n8n hosting or networking.
- **Separate audit access**: only a security/compliance role can read the archive; application admins can't.

## 3. Queueing between Convex and n8n

**Today:** a mutation schedules a Convex action (`notify.sendLoanEvent`) after commit; the action signs and posts the webhook and retries with exponential backoff (5 attempts), then records a visible failure. Convex's scheduler is durable, so a crash doesn't lose events. But n8n receives requests as fast as Convex sends them.

**In production:**
- **Put a queue in the middle**: Convex action → **Amazon SQS** (or Upstash QStash) → n8n consumer. The queue absorbs bursts (e.g. many approvals at once or an overdue sweep), smooths load on n8n, and gives us a **dead-letter queue** for messages that keep failing, with an alarm on DLQ depth.
- **Keep idempotency keys end to end** (already in every payload), since SQS standard queues deliver at least once.
- **Run n8n in queue mode** (main + workers + Redis) so long workflows don't block webhook intake.

## 4. Rate limiting and abuse protection

**Today:** per-user, fixed-window limits enforced in Convex mutations for borrow requests, listings, photo uploads and ratings.

**In production:**
- **Rate-limit public reads.** The public tool list is unauthenticated. Convex queries can't write counters, so limit at the edge: **AWS WAF rate-based rules** (or Cloudflare) per IP on the site and the Convex HTTP endpoints, plus caching the public list for a short TTL.
- **Bot protection** on sign-up (Clerk's built-in bot protection / CAPTCHA) and on the webhook endpoints (WAF allow-list for n8n's egress IPs).
- **Token-bucket limits** instead of fixed windows for smoother behaviour, using the Convex rate-limiter component.

## 5. Secrets and configuration

**Today:** secrets live in Convex environment variables and a git-ignored `.env.n8n`. They never appear in code or exported workflow JSON.

**In production:**
- **AWS Secrets Manager** (or HashiCorp Vault) as the source of truth, injected into n8n at runtime by the container platform (ECS task definitions reference the secret ARN), and synced to Convex env vars by CI with least-privilege credentials.
- **Rotation without downtime**: verify against both the current and previous HMAC secret during a rotation window, sign with the new one, then retire the old.
- **Least privilege everywhere**: separate IAM roles for CI, n8n and humans; no long-lived access keys.

## 6. Hosting n8n on AWS

**Today:** `docker compose` on one machine, bound to localhost.

**In production:**
- **ECS Fargate** (main + worker services) in **private subnets**, **RDS PostgreSQL** instead of SQLite for workflow and execution data, **ElastiCache Redis** for queue mode.
- **Application Load Balancer** with TLS (ACM certificate) in front, **AWS WAF** attached: managed rule groups (common exploits, known bad inputs), rate-based rules, and an allow-list so only Convex can reach the webhook path. The n8n editor UI is only reachable over VPN or SSO, never publicly.
- Use n8n's **external task runner mode** to isolate Code-node execution from the main process.

## 7. Infrastructure as code and delivery

- **Terraform** (or AWS CDK) for the whole AWS footprint: VPC, ECS, RDS, ALB, WAF, Secrets Manager, S3 audit bucket with Object Lock, alarms. Reviewed in pull requests like application code.
- **Environments:** dev, staging and production Convex deployments and Clerk instances; CI deploys Convex functions with `npx convex deploy` after tests pass, and imports n8n workflows from the repo.
- **CI already runs** lint, format, type-check, unit and Convex function tests, a build and a dependency audit. Add the Playwright suite against a preview deployment using Clerk testing tokens, and a Terraform plan check.

## 8. Observability

- **Errors:** Sentry on the Next.js app; Convex log streaming to Datadog or CloudWatch.
- **Metrics and alarms:** webhook failure rate, retries exhausted, DLQ depth, overdue reminders sent per day, error-workflow executions. Alert on-call when any of these move.
- **Synthetic checks:** an uptime probe that sends a signed test event to n8n and expects a 200.

## 9. Privacy and data protection

- **Pickup details** already follow staged disclosure and are deleted after the loan. In production, add a **retention policy** for closed loans (e.g. anonymise borrower and lender references after 12 months).
- **Photos:** EXIF is stripped in the browser today; also re-encode server-side (a Node action with `sharp`) so a modified client can't skip it.
- **Data subject requests:** an admin flow to export or delete a user's data, which also removes their photos from storage.

---

## Rough order of work

| Priority | Item | Why first |
|---|---|---|
| 1 | Secrets Manager, Terraform, staging environment | Everything else depends on safe, repeatable infrastructure |
| 2 | Admin MFA + Clerk webhook role sync | Smallest change with the biggest drop in account-takeover risk |
| 3 | n8n on ECS behind ALB + WAF, RDS, real email delivery | Moves the automation from "demo" to dependable |
| 4 | SQS between Convex and n8n, DLQ alarms | Burst handling and visible failures at scale |
| 5 | Immutable audit archive (S3 Object Lock) | Accountability that survives a compromised admin |
| 6 | Edge rate limiting, server-side photo processing, retention jobs | Hardening and privacy completeness |
