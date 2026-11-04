# LendLoop

**Borrow what you need. Lend what you don't.**

A neighborhood tool-lending board. Neighbors list tools, request to borrow them for a date range, and approve, decline, or close out loans. n8n handles the automated notifications and daily overdue reminders.

Stack: Next.js 16 (App Router) · Clerk · Convex · n8n (self-hosted, Docker) · TypeScript

![CI](../../actions/workflows/ci.yml/badge.svg)

## Features

**Required by the brief**
- Public page with available tools (name and category only) and Clerk sign-in
- List, edit and delete tools; request a date range; approve, decline and mark returned
- Browse with availability and a category filter; My listings, My requests and Incoming requests views
- `admin` and `user` roles enforced in Convex functions
- Two n8n workflows (request notifications, daily overdue reminders) signed with HMAC in both directions, idempotent, retried, with an error workflow
- Latest automation shown on each loan ("Reminder sent 2 days ago")

**Added**
| Feature | Why |
|---|---|
| **Tool photos** with server-side type and size checks | People decide faster with a picture; uploads are a classic attack surface, so they are validated on the server |
| **Tool page with a booking calendar** | Borrowers see busy dates before asking, so fewer requests get declined |
| **Note to the owner** on each request | "Need it for the fence on Saturday" is what makes someone say yes |
| **Loan timeline** (every action and automation, in order) | One place to answer "what happened with this loan?" |
| **Two-way ratings** after a return | Trust between strangers; gives admins evidence for "Trusted Lender" |
| **Admin audit log** with a required reason for removals | Moderation is accountable and reviewable |
| **Rate limiting** per user | Stops spam requests and upload abuse |
| **Search** across tool names and descriptions | Faster browsing |
| **Staged pickup disclosure** (neighborhood → pickup details only after approval) | The brief has no handover step, and any handover reveals where the owner lives. See below. |

---

## Quick start

Requirements: Node 20+, Docker.

```bash
npm install
cp .env.example .env.local
```

### 1. Clerk

1. Create an application at [dashboard.clerk.com](https://dashboard.clerk.com).
2. Copy the publishable and secret keys into `.env.local`.
3. Open **Integrations → Convex** and activate it. This creates the `convex` JWT template that Convex validates.
4. Copy your **Frontend API URL** (looks like `https://verb-noun-00.clerk.accounts.dev`). You need it in step 2.

### 2. Convex

```bash
npx convex dev            # first run: log in and create a project (cloud or local)
npx convex env set CLERK_JWT_ISSUER_DOMAIN https://verb-noun-00.clerk.accounts.dev
```

Leave `npx convex dev` running in its own terminal. It pushes functions and writes `NEXT_PUBLIC_CONVEX_URL` to `.env.local`.

### 3. n8n

Generate two secrets, one for each direction of the integration:

```bash
openssl rand -hex 32   # CONVEX_TO_N8N_SECRET
openssl rand -hex 32   # N8N_TO_CONVEX_SECRET
```

Set them in Convex, together with the n8n webhook URL:

```bash
npx convex env set CONVEX_TO_N8N_SECRET <first secret>
npx convex env set N8N_TO_CONVEX_SECRET <second secret>
npx convex env set N8N_NOTIFY_WEBHOOK_URL http://localhost:5678/webhook/lendloop-loan-event
```

Then configure and start n8n:

```bash
cp .env.n8n.example .env.n8n   # same two secrets + your Convex HTTP actions URL
./scripts/n8n-setup.sh         # imports + activates the 3 workflows, starts n8n
```

Open http://localhost:5678 and create the owner account. The three LendLoop workflows are already active.

> **Reaching n8n from a cloud Convex deployment.** A cloud deployment can't call `localhost`. Either run Convex locally (`npx convex dev --configure new --dev-deployment local`), expose n8n with a tunnel (e.g. `cloudflared tunnel --url http://localhost:5678`), or use n8n Cloud. Then set `N8N_NOTIFY_WEBHOOK_URL` to that URL. For a local Convex backend, set `CONVEX_SITE_URL=http://host.docker.internal:3211` in `.env.n8n`.

### 4. Run

```bash
npm run dev                                                 # http://localhost:3000
npx convex run users:makeAdmin '{"email":"you@example.com"}'  # after your first sign-in
npx convex run seed:demo                                    # optional demo data, incl. an overdue loan
```

### Tests

```bash
npm test          # 26 tests: Convex functions (roles, loans, pickup privacy, ratings, audit log,
                  # rate limits, photo validation, idempotency, HTTP auth) and HMAC signing
npm run test:e2e  # 6 Playwright smoke tests against the running stack (uses installed Chrome):
                  # public page + live Convex data, no owner details in public, Clerk sign-in,
                  # signed-out redirect, security headers, n8n endpoints reject unsigned calls
```

`scripts/sign-test.mjs` sends a signed, forged, or stale event straight to the n8n webhook:

```bash
node --env-file=.env.n8n scripts/sign-test.mjs good   # 200
node --env-file=.env.n8n scripts/sign-test.mjs bad    # 401
node --env-file=.env.n8n scripts/sign-test.mjs stale  # 401
```

---

## Design

A "library card" identity: old checkout cards stamped in indigo ink, with a red string on the tag.

- **Logo:** a lending hang tag whose punch hole is a house. One filled shape, so it stays legible as a 16 px favicon.
- **Colors:** cool paper `#F5F6FA`, ink `#1B1A3A`, stamp indigo `#3A36A8` (8.6:1 on paper), string red `#E2462F` used only for icons and badges (3.8:1, so never small text). All text pairs pass WCAG AA.
- **Type:** Young Serif for headings (local, sign-over-the-counter feel) and Atkinson Hyperlegible Next for body, designed by the Braille Institute for low-vision readers. Both self-hosted, so no request goes to a font CDN and the CSP stays `'self'`.
- **Accessibility:** visible focus rings, native `<dialog>` for confirmations (focus trap, Escape), labelled icon buttons, star ratings as a radio group, reduced-motion respected.

---

## Environment variables

| Where | Variable | Purpose |
|---|---|---|
| `.env.local` | `NEXT_PUBLIC_CONVEX_URL`, `CONVEX_DEPLOYMENT` | Written by `npx convex dev` |
| `.env.local` | `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY`, `CLERK_SECRET_KEY` | Clerk keys |
| Convex env | `CLERK_JWT_ISSUER_DOMAIN` | Clerk Frontend API URL; Convex only accepts JWTs from this issuer with `aud: convex` |
| Convex env | `N8N_NOTIFY_WEBHOOK_URL` | n8n webhook for loan events |
| Convex env + `.env.n8n` | `CONVEX_TO_N8N_SECRET` | Signs Convex → n8n webhooks |
| Convex env + `.env.n8n` | `N8N_TO_CONVEX_SECRET` | Signs n8n → Convex calls |
| `.env.n8n` | `CONVEX_SITE_URL` | Convex HTTP actions URL (`*.convex.site`) |
| `.env.n8n` | `ALERT_WEBHOOK_URL` | Optional Slack/Discord webhook for failure alerts |

All `.env*` files except the examples are git-ignored. No secret appears in code or in the exported workflow JSON. The workflows read them from the environment at run time.

---

## Architecture

```
 Browser (Next.js + Clerk)
   │  Clerk session → JWT (template "convex")
   ▼
 Convex ── queries / mutations ── every access check runs here (convex/lib/auth.ts)
   │
   │  mutation commits → scheduler → notify.sendLoanEvent (action)
   │        POST  HMAC-signed, retried with backoff
   ▼
 n8n  "Loan request notification"   verify signature → dedupe → notify → 200 / 401
 n8n  "Daily overdue reminders"      09:00 → GET /n8n/overdue-loans (signed)
                                      → remind each borrower
                                      → POST /n8n/reminder-status (signed, idempotent)
 n8n  "Error handler"                any failed run → log (+ optional chat alert)
```

| Path | What lives there |
|---|---|
| `convex/schema.ts` | `users`, `tools`, `loans`, `loanEvents`, `automationEvents`, `ratings`, `auditLog`, `rateLimits` |
| `convex/lib/auth.ts` | `requireViewer`, `requireAdmin`, `isOwnerOrAdmin` |
| `convex/tools.ts`, `convex/loans.ts`, `convex/users.ts`, `convex/ratings.ts` | App functions |
| `convex/lib/rateLimit.ts`, `convex/lib/history.ts` | Rate limiting; timeline, audit and rating helpers |
| `convex/storage.ts`, `convex/crons.ts` | Daily cleanup of uploads no listing uses |
| `convex/notify.ts` | Signed outbound webhook with retries |
| `convex/http.ts`, `convex/automation.ts` | Endpoints n8n calls, idempotent write-back |
| `convex/lib/hmac.ts` | Signing and verification |
| `n8n/workflows/*.json` | Exported workflows (no secrets) |
| `app/` | Public page, dashboard, tool page (`app/dashboard/tools/[id]`) |
| `proxy.ts`, `next.config.ts` | Content-Security-Policy and security headers |
| `.github/workflows/ci.yml` | Lint, format, type-check, tests, build, dependency audit |

### Roles

| | user | admin |
|---|---|---|
| List / edit / delete **own** tools | ✅ | ✅ |
| Delete **any** listing | ❌ | ✅ |
| Request to borrow, cancel **own** pending request | ✅ | ✅ |
| Approve / decline / mark returned on **own** tools | ✅ | ✅ (own only) |
| See all loans, mark Trusted Lender | ❌ | ✅ |

Roles are enforced in Convex functions. The UI only hides buttons a user can't use. `role` is never read from the client: a new user is always `user`, and admin is granted through an internal function that only the CLI or dashboard can call (`users:makeAdmin`). Admins can remove listings but not edit other people's, and they can't approve loans on someone else's behalf. Moderation and lending are kept separate on purpose.

---

## Security and data minimization

**Authentication**
- Convex verifies the Clerk JWT itself (issuer and `applicationID: "convex"`).
- Users are keyed by `tokenIdentifier` from the verified token, never by an id the client sends.
- `app/dashboard/layout.tsx` redirects signed-out visitors to sign in. That is UX, not the security boundary.

**Authorization**
- Every public query and mutation starts with `requireViewer` or `requireAdmin`.
- Admin-only data never reaches non-admins.
- Tests in `convex/rbac.test.ts` call the functions as other users and assert they are rejected.

**What each audience sees**
- **Anonymous visitors:** available tools' name and category only. No owner, description or loan data.
- **Signed-in neighbors:** a lender's display name and trust badge, never their email.
- **Emails:** only admins and the notification payload for the person being notified ever see them.

**Webhook signing (both directions)**
- HMAC-SHA256 over `timestamp + "." + rawBody`, sent in `X-LendLoop-Timestamp` and `X-LendLoop-Signature`.
- Requests older than 5 minutes are rejected (replay protection).
- Comparison is constant time (`crypto.subtle.verify` in Convex, `timingSafeEqual` in n8n).
- Each direction has its own secret, so leaking one does not let an attacker forge the other.
- The n8n webhook verifies the raw body, not re-serialized JSON.

**Minimal payloads**
- A notification carries the recipient's name and email, the tool name, dates and status. Nothing else.
- The overdue endpoint returns only what a reminder needs.
- n8n never receives user ids or the other party's contact details.

**Idempotency**
- Every automation result is written with a deterministic key (`overdue:<loanId>:<date>`, `notify:<loanId>:<status>:<recipient>`).
- `automation.record` upserts on that key, so retries and double runs never create duplicate rows.
- The overdue endpoint skips loans already reminded today.
- The notification workflow also dedupes on the key, so a Convex retry after a lost response does not message someone twice.
- The write-back endpoint only accepts reminder keys of the exact shape it issues.

**Failure handling**
- Convex retries outbound webhooks with exponential backoff (5 attempts), then records a visible `failed` event on the loan.
- n8n HTTP nodes retry 3 times.
- Both workflows point to an error workflow that logs every failed run and can alert Slack or Discord.
- The UI shows the latest automation per loan ("Reminder sent 2 days ago", "Notification failed …").

**Input validation**
- Lengths are capped and text trimmed.
- Dates are validated server-side: no past start, end after start, at most 30 days.
- Overlapping approved loans are rejected at request time and again at approval.
- A tool id taken from the URL is normalized, so a malformed link shows "not found" instead of an error.

**Pickup location (staged disclosure)**
- Physical lending means someone eventually learns where the tool is. The goal is to share the least, with the fewest people, as late as possible.
- Listings carry only a coarse **neighborhood** ("Bole"), shown to signed-in neighbors. Never an address. The public page doesn't show it at all.
- The owner writes **pickup details** when approving: a public meet-up spot (suggested as safer) or home instructions.
- Only the **approved borrower** sees them, and only while the loan is active. Other neighbors never see them, and **admins don't either**: moderation doesn't need anyone's address.
- Pickup details are **deleted** when the tool is returned or the listing removed, not kept "just in case".
- They are **never sent to n8n**. The approval notification only says "pickup details are in the app".
- Covered by tests in `convex/features.test.ts` ("pickup details (staged disclosure)").

**Uploads**
- The browser uploads to a short-lived Convex URL, but a file only becomes a tool photo after the server checks it: JPEG, PNG or WebP, at most 5 MB, not already used by another listing.
- A rejected file can't be deleted inside the failing mutation (Convex rolls that back too), so a daily cron removes any upload no listing uses. That also covers abandoned uploads.
- Replaced and removed photos are deleted right away.
- **Location privacy:** phone photos usually embed GPS coordinates (EXIF). The browser re-draws each photo on a canvas before upload, which drops all metadata, so a neighbor can't learn where the owner lives from a tool picture. It also scales photos to at most 1600 px.

**Abuse limits**
- Per-user fixed-window limits stored in Convex: 10 borrow requests, 20 listings, 30 uploads and 30 ratings per hour.
- Mutations are transactional, so concurrent calls can't slip past a limit.

**Ratings and accountability**
- Only the two people in a loan can rate it, once each, and only after it's returned.
- Every admin action (listing removal, trust changes) goes to an append-only audit log with actor, time and reason. Removing someone else's listing requires a reason.

**Browser hardening**
- **Content-Security-Policy** (via Clerk's middleware, merged with what Clerk needs): `frame-ancestors 'none'`, `object-src 'none'`, `base-uri` and `form-action` limited to self; `connect-src` and `img-src` limited to Convex and Clerk.
- **Headers:** `X-Content-Type-Options: nosniff`, `X-Frame-Options: DENY`, a strict `Referrer-Policy`, a `Permissions-Policy` that disables camera, microphone, location and payment, and HSTS. `X-Powered-By` is removed.
- **Trade-off:** `script-src` still allows inline scripts. A nonce-based strict CSP needs every page rendered per request, which gives up the static shell that Cache Components prerender. For production I'd measure that cost and likely switch to nonces.

---

## What I'd change for production

The full plan, with an AWS deployment in mind (SCIM and admin MFA, an immutable audit archive on S3 Object Lock, SQS between Convex and n8n, edge rate limiting with WAF, Secrets Manager, n8n on ECS behind an ALB, Terraform), is in **[PRODUCTION_CONSIDERATIONS.md](PRODUCTION_CONSIDERATIONS.md)**. The short version:

- **Strict CSP with nonces**, as described above.
- **Server-side photo processing:** metadata stripping currently happens in the browser, which a modified client could skip. In production I'd also re-encode on the server (a Node action with `sharp`) and generate thumbnails.

- **Real delivery:** replace the mock notify nodes with Send Email (SMTP or SES) or Slack nodes using n8n credentials, and add per-user notification preferences and unsubscribe links.
- **n8n hardening:**
  - Use n8n's external task runner mode instead of internal.
  - Use Postgres instead of SQLite.
  - Put it behind TLS on a private network or allowlist.
  - Keep secrets in a manager (Doppler, AWS Secrets Manager) instead of a `.env` file.
  - Store dedupe keys in a shared store (Postgres or Redis) rather than workflow static data.
- **Secret rotation:** accept two active secrets per direction during rotation (verify against either, sign with the new one).
- **Roles from Clerk:** move them into Clerk organization roles or public metadata, synced by a Clerk webhook, so admin management doesn't need the CLI.
- **Audit log:** a table of admin actions (listing removals, trust changes) with actor and timestamp.
- **Scale:** paginate tool and loan lists, and denormalize current availability onto `tools` so lists don't scan loans.
- **Timezones:** store a timezone per user and compute "overdue" in the borrower's local day.
- **Observability:** Sentry on the Next.js app, Convex log streaming to Datadog, alerts on the error workflow, and an uptime check on the n8n webhook.
- **Full end-to-end coverage:** the Playwright suite is a smoke test. Next I'd add Clerk testing tokens and two test users to drive request → approve → pickup → return → rate in a real browser, and run it in CI against a preview deployment.

---

## Notes

Built with AI assistance (Claude Code) for scaffolding and boilerplate. I reviewed and tested every change, and the design decisions above are mine.
