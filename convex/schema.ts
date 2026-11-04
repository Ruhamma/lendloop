import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";
import { CATEGORIES, CONDITIONS } from "./lib/constants";

export const category = v.union(...CATEGORIES.map((c) => v.literal(c)));
export const condition = v.union(...CONDITIONS.map((c) => v.literal(c)));

export const loanStatus = v.union(
  v.literal("pending"),
  v.literal("approved"),
  v.literal("declined"),
  v.literal("cancelled"),
  v.literal("returned"),
);

export default defineSchema({
  users: defineTable({
    // Clerk identity `tokenIdentifier` (issuer + subject); never trust a client-sent id.
    tokenIdentifier: v.string(),
    name: v.string(),
    email: v.string(),
    role: v.union(v.literal("admin"), v.literal("user")),
    trustedLender: v.boolean(),
  })
    .index("by_token", ["tokenIdentifier"])
    .index("by_email", ["email"])
    .searchIndex("search_name", { searchField: "name" }),

  tools: defineTable({
    ownerId: v.id("users"),
    name: v.string(),
    category,
    condition,
    description: v.string(),
    photoId: v.optional(v.id("_storage")),
    // Coarse area only ("Bole", "Kazanchis"), shown to signed-in neighbors. Never an address.
    neighborhood: v.optional(v.string()),
  })
    .index("by_owner", ["ownerId"])
    .index("by_category", ["category"])
    .index("by_photo", ["photoId"])
    .index("by_name", ["name"])
    .searchIndex("search_name", { searchField: "name", filterFields: ["category", "ownerId"] }),

  loans: defineTable({
    toolId: v.id("tools"),
    ownerId: v.id("users"),
    borrowerId: v.id("users"),
    // ISO dates (YYYY-MM-DD), inclusive.
    startDate: v.string(),
    endDate: v.string(),
    status: loanStatus,
    returnedAt: v.optional(v.number()),
    // Optional message from the borrower to the owner ("Need it for the fence on Saturday").
    note: v.optional(v.string()),
    searchText: v.optional(v.string()),
    // How to collect the tool. Written by the owner on approval, shown only to the approved
    // borrower while the loan is active, and deleted when the loan ends.
    pickup: v.optional(
      v.object({
        kind: v.union(v.literal("home"), v.literal("meetup")),
        details: v.string(),
      }),
    ),
  })
    .index("by_tool", ["toolId"])
    .index("by_owner", ["ownerId"])
    .index("by_borrower", ["borrowerId"])
    .index("by_status_end", ["status", "endDate"])
    // Tool, owner and borrower names, so admins can search loans by any of them. Kept in
    // sync on create (loans.request) and backfilled once by loans.backfillSearchText.
    .searchIndex("search_text", {
      searchField: "searchText",
      filterFields: ["ownerId", "borrowerId", "status"],
    }),

  // Audit trail of everything the n8n integration did. `key` is the idempotency key:
  // a retried write-back with the same key is a no-op instead of a duplicate row.
  automationEvents: defineTable({
    loanId: v.id("loans"),
    kind: v.union(v.literal("notification"), v.literal("overdue_reminder")),
    status: v.union(v.literal("sent"), v.literal("failed")),
    key: v.string(),
    detail: v.optional(v.string()),
  })
    .index("by_key", ["key"])
    .index("by_loan", ["loanId"]),

  // What people did to a loan, in order. Merged with automationEvents into the loan timeline.
  loanEvents: defineTable({
    loanId: v.id("loans"),
    actorId: v.id("users"),
    type: v.union(
      v.literal("requested"),
      v.literal("approved"),
      v.literal("declined"),
      v.literal("cancelled"),
      v.literal("returned"),
      v.literal("listing_removed"),
    ),
  }).index("by_loan", ["loanId"]),

  // One rating per person per finished loan, given to the other party.
  ratings: defineTable({
    loanId: v.id("loans"),
    raterId: v.id("users"),
    rateeId: v.id("users"),
    // The role the rated person played in this loan.
    rateeRole: v.union(v.literal("lender"), v.literal("borrower")),
    stars: v.number(),
    comment: v.optional(v.string()),
  })
    .index("by_loan_rater", ["loanId", "raterId"])
    .index("by_ratee", ["rateeId"]),

  // Append-only record of every admin action: who did what to whom, when, and why.
  auditLog: defineTable({
    actorId: v.id("users"),
    action: v.union(
      v.literal("listing_removed"),
      v.literal("trusted_granted"),
      v.literal("trusted_revoked"),
    ),
    targetLabel: v.string(),
    reason: v.optional(v.string()),
  }),

  // Fixed-window counters for rate limiting, keyed by action and user.
  rateLimits: defineTable({
    key: v.string(),
    windowStart: v.number(),
    count: v.number(),
  }).index("by_key", ["key"]),
});
