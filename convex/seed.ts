import { v } from "convex/values";
import type { Doc, Id } from "./_generated/dataModel";
import { internalMutation, type MutationCtx } from "./_generated/server";

const DAY = 86_400_000;
const iso = (offsetDays: number) =>
  new Date(Date.now() + offsetDays * DAY).toISOString().slice(0, 10);

/**
 * Demo data for local development, including one overdue loan for the reminder workflow.
 * Internal only (not callable from the browser):  npx convex run seed:demo
 */
export const demo = internalMutation({
  args: {},
  handler: async (ctx) => {
    const existing = await ctx.db.query("users").first();
    if (existing) return "Database is not empty; skipping seed.";

    const ana = await ctx.db.insert("users", {
      tokenIdentifier: "seed|ana",
      name: "Ana (demo)",
      email: "ana@example.com",
      role: "user",
      trustedLender: true,
    });
    const ben = await ctx.db.insert("users", {
      tokenIdentifier: "seed|ben",
      name: "Ben (demo)",
      email: "ben@example.com",
      role: "user",
      trustedLender: false,
    });

    const drill = await ctx.db.insert("tools", {
      ownerId: ana,
      name: "Cordless drill",
      category: "power_tools",
      condition: "good",
      description: "18V with two batteries and a bit set.",
      neighborhood: "Bole",
    });
    await ctx.db.insert("tools", {
      ownerId: ana,
      name: "Hedge trimmer",
      category: "garden",
      condition: "fair",
      description: "Electric, 50 cm blade. Extension cord not included.",
      neighborhood: "Bole",
    });
    await ctx.db.insert("tools", {
      ownerId: ben,
      name: "4-person tent",
      category: "camping",
      condition: "new",
      description: "Used once. Pegs and rain fly included.",
      neighborhood: "Kazanchis",
    });

    // Ben borrowed the drill and is two days late returning it.
    await ctx.db.insert("loans", {
      toolId: drill,
      ownerId: ana,
      borrowerId: ben,
      startDate: iso(-6),
      endDate: iso(-2),
      status: "approved",
      pickup: { kind: "meetup", details: "Demo: Kaldi's Coffee, Bole, weekdays after 6pm" },
    });
    return "Seeded 2 users, 3 tools, 1 overdue loan.";
  },
});

const SHOWCASE_TABLES = [
  "ratings",
  "loanEvents",
  "automationEvents",
  "auditLog",
  "loans",
  "tools",
  "rateLimits",
] as const;

/** Delete everything except real (Clerk) users, including uploaded tool photos. */
async function wipe(ctx: MutationCtx) {
  for (const table of SHOWCASE_TABLES) {
    for (const row of await ctx.db.query(table).collect()) {
      if (table === "tools") {
        const photoId = (row as Doc<"tools">).photoId;
        if (photoId) await ctx.storage.delete(photoId);
      }
      await ctx.db.delete(row._id);
    }
  }
  for (const user of await ctx.db.query("users").collect()) {
    if (user.tokenIdentifier.startsWith("seed|")) await ctx.db.delete(user._id);
    else await ctx.db.patch(user._id, { trustedLender: false });
  }
}

type Neighbor = { key: string; name: string; trusted?: boolean };
type ToolSpec = Omit<Doc<"tools">, "_id" | "_creationTime" | "ownerId"> & {
  key: string;
  owner: string;
};
type LoanSpec = {
  tool: string;
  borrower: string;
  start: number;
  end: number;
  status: Doc<"loans">["status"];
  note?: string;
  pickup?: Doc<"loans">["pickup"];
  /** For returned loans: [owner's stars for the borrower, borrower's stars for the owner]. */
  ratings?: [number, string, number, string];
  /** Record a failed n8n notification for this loan (shows failure handling in the audit log). */
  notifyFailed?: boolean;
};

const NEIGHBORS: Neighbor[] = [
  { key: "selam", name: "Selam Tesfaye", trusted: true },
  { key: "dawit", name: "Dawit Bekele" },
  { key: "meron", name: "Meron Haile", trusted: true },
  { key: "yonas", name: "Yonas Alemu" },
  { key: "kidus", name: "Kidus Tadesse" },
  { key: "liya", name: "Liya Mekonnen" },
  { key: "abel", name: "Abel Worku" },
  { key: "bethlehem", name: "Bethlehem Assefa" },
];

const TOOLS: ToolSpec[] = [
  // "me" is the signed-in admin running the demo.
  {
    key: "sander",
    owner: "me",
    name: "Orbital sander",
    category: "power_tools",
    condition: "good",
    neighborhood: "Bole",
    description:
      "125 mm random orbit sander with a dust bag and 20 sanding discs from coarse to fine.",
  },
  {
    key: "table",
    owner: "me",
    name: "Folding table and 6 chairs",
    category: "other",
    condition: "good",
    neighborhood: "Bole",
    description:
      "Fits in a small car. Perfect for coffee ceremonies, birthdays and holiday lunches.",
  },
  {
    key: "cables",
    owner: "me",
    name: "Car jumper cables",
    category: "other",
    condition: "new",
    neighborhood: "Bole",
    description: "4 m heavy duty cables. Works for cars and minibuses.",
  },
  {
    key: "drill",
    owner: "selam",
    name: "Bosch cordless drill",
    category: "power_tools",
    condition: "good",
    neighborhood: "Bole",
    description:
      "18V with two batteries, a charger and a 30 piece bit set. Great for shelves and curtain rails.",
  },
  {
    key: "washer",
    owner: "selam",
    name: "Pressure washer",
    category: "cleaning",
    condition: "good",
    neighborhood: "Bole",
    description:
      "Kärcher K3. Cleans compound floors, cars and gates in minutes. Needs an outdoor tap.",
  },
  {
    key: "ladder",
    owner: "selam",
    name: "6 step aluminium ladder",
    category: "hand_tools",
    condition: "fair",
    neighborhood: "Bole",
    description: "Reaches most ceilings. Light enough to carry alone.",
  },
  {
    key: "saw",
    owner: "dawit",
    name: "Circular saw",
    category: "power_tools",
    condition: "good",
    neighborhood: "Kazanchis",
    description: "Makita 185 mm with a sharp blade and a guide rail. Eye protection included.",
  },
  {
    key: "tilecutter",
    owner: "dawit",
    name: "Manual tile cutter",
    category: "hand_tools",
    condition: "good",
    neighborhood: "Kazanchis",
    description: "Cuts ceramic and porcelain tiles up to 60 cm. Spare scoring wheel in the box.",
  },
  {
    key: "mitad",
    owner: "meron",
    name: "Electric mitad",
    category: "kitchen",
    condition: "good",
    neighborhood: "Sarbet",
    description: "60 cm electric mitad for baking injera for big family gatherings.",
  },
  {
    key: "mixer",
    owner: "meron",
    name: "Stand mixer",
    category: "kitchen",
    condition: "good",
    neighborhood: "Sarbet",
    description: "4.8 L bowl with whisk, paddle and dough hook. Ideal for cakes and bread.",
  },
  {
    key: "jebena",
    owner: "meron",
    name: "Coffee ceremony set",
    category: "kitchen",
    condition: "new",
    neighborhood: "Sarbet",
    description: "Clay jebena, six sini cups, a roasting pan and a rekebot tray.",
  },
  {
    key: "tent",
    owner: "yonas",
    name: "4 person tent",
    category: "camping",
    condition: "good",
    neighborhood: "CMC",
    description:
      "Waterproof with a rain fly and pegs. Sets up in 10 minutes. Used on trips to Wenchi and Langano.",
  },
  {
    key: "sleepingbags",
    owner: "yonas",
    name: "Two sleeping bags",
    category: "camping",
    condition: "good",
    neighborhood: "CMC",
    description: "Rated to 5°C, washed after every trip.",
  },
  {
    key: "stove",
    owner: "yonas",
    name: "Camping stove",
    category: "camping",
    condition: "fair",
    neighborhood: "CMC",
    description: "Single burner gas stove. Bring your own canister.",
  },
  {
    key: "mower",
    owner: "kidus",
    name: "Electric lawn mower",
    category: "garden",
    condition: "good",
    neighborhood: "Old Airport",
    description: "32 cm cut with a grass box. 20 m extension cord included.",
  },
  {
    key: "trimmer",
    owner: "kidus",
    name: "Hedge trimmer",
    category: "garden",
    condition: "fair",
    neighborhood: "Old Airport",
    description: "Electric, 50 cm blade. Keeps compound hedges tidy.",
  },
  {
    key: "wheelbarrow",
    owner: "kidus",
    name: "Wheelbarrow",
    category: "garden",
    condition: "worn",
    neighborhood: "Old Airport",
    description: "Old but solid. The tyre holds air for a full day of work.",
  },
  {
    key: "carpet",
    owner: "liya",
    name: "Carpet cleaner",
    category: "cleaning",
    condition: "good",
    neighborhood: "Gerji",
    description: "Deep cleans rugs and sofas. Shampoo included for two rooms.",
  },
  {
    key: "steammop",
    owner: "liya",
    name: "Steam mop",
    category: "cleaning",
    condition: "new",
    neighborhood: "Gerji",
    description: "Kills germs on tiles without chemicals. Two washable pads.",
  },
  {
    key: "sockets",
    owner: "abel",
    name: "Socket wrench set",
    category: "hand_tools",
    condition: "good",
    neighborhood: "Piassa",
    description: "94 pieces, metric and imperial, in a hard case.",
  },
  {
    key: "projector",
    owner: "abel",
    name: "Projector and screen",
    category: "other",
    condition: "good",
    neighborhood: "Piassa",
    description:
      "1080p projector with a 100 inch pull up screen. Movie nights and football matches.",
  },
  {
    key: "sewing",
    owner: "bethlehem",
    name: "Sewing machine",
    category: "other",
    condition: "good",
    neighborhood: "Ayat",
    description: "Singer with 20 stitch patterns. Good for hems, curtains and school uniforms.",
  },
  {
    key: "roller",
    owner: "bethlehem",
    name: "Paint roller kit",
    category: "hand_tools",
    condition: "good",
    neighborhood: "Ayat",
    description: "Two rollers, an extension pole, a tray and drop cloths.",
  },
];

const LOANS: LoanSpec[] = [
  // Waiting for an answer: two requests to you, one from you.
  {
    tool: "sander",
    borrower: "dawit",
    start: 2,
    end: 4,
    status: "pending",
    note: "Sanding an old wooden door before I paint it this weekend.",
  },
  {
    tool: "table",
    borrower: "liya",
    start: 5,
    end: 6,
    status: "pending",
    note: "Hosting a coffee ceremony for my mother's birthday.",
  },
  {
    tool: "mitad",
    borrower: "me",
    start: 3,
    end: 4,
    status: "pending",
    note: "Baking injera for Genna lunch with the family.",
  },
  // Approved: upcoming, active, and two overdue (one of them your jumper cables).
  {
    tool: "tent",
    borrower: "me",
    start: 7,
    end: 10,
    status: "approved",
    note: "Weekend trip to Lake Langano.",
    pickup: { kind: "meetup", details: "Tomoca Coffee, Piassa, Saturday at 10am" },
  },
  {
    tool: "drill",
    borrower: "abel",
    start: -2,
    end: 3,
    status: "approved",
    note: "Putting up shelves in the kids' room.",
    pickup: { kind: "home", details: "Blue gate next to the pharmacy, ring twice" },
  },
  {
    tool: "saw",
    borrower: "kidus",
    start: -8,
    end: -3,
    status: "approved",
    note: "Cutting boards for a garden bed.",
    pickup: { kind: "meetup", details: "Kazanchis Total station, weekdays after 6pm" },
  },
  {
    tool: "cables",
    borrower: "bethlehem",
    start: -4,
    end: -1,
    status: "approved",
    note: "My car battery died at the office.",
    pickup: { kind: "meetup", details: "Edna Mall parking, after work" },
    notifyFailed: true,
  },
  // Finished loans with ratings both ways.
  {
    tool: "washer",
    borrower: "me",
    start: -20,
    end: -17,
    status: "returned",
    ratings: [
      5,
      "Returned it clean and on time. Welcome back any time.",
      5,
      "Selam showed me how to use it. Super helpful.",
    ],
  },
  {
    tool: "mixer",
    borrower: "yonas",
    start: -15,
    end: -13,
    status: "returned",
    ratings: [
      5,
      "Careful and friendly.",
      4,
      "Worked perfectly. Pickup was a little late but no problem.",
    ],
  },
  {
    tool: "mower",
    borrower: "liya",
    start: -30,
    end: -28,
    status: "returned",
    ratings: [
      4,
      "All good, grass box could have been emptied.",
      5,
      "Great mower, Kidus even brought the cord.",
    ],
  },
  {
    tool: "sander",
    borrower: "dawit",
    start: -12,
    end: -10,
    status: "returned",
    ratings: [5, "Returned it cleaner than I lent it.", 5, "Easy pickup and great discs."],
  },
  {
    tool: "projector",
    borrower: "selam",
    start: -9,
    end: -8,
    status: "returned",
    ratings: [5, "Perfect borrower.", 5, "Football night was a hit. Thank you Abel!"],
  },
  // Closed without a loan.
  {
    tool: "stove",
    borrower: "abel",
    start: -1,
    end: 1,
    status: "declined",
    note: "Quick hike to Entoto.",
  },
  {
    tool: "carpet",
    borrower: "meron",
    start: 1,
    end: 2,
    status: "cancelled",
    note: "Cleaning the living room rug.",
  },
];

const EVENTS_FOR: Record<Doc<"loans">["status"], Doc<"loanEvents">["type"][]> = {
  pending: ["requested"],
  approved: ["requested", "approved"],
  returned: ["requested", "approved", "returned"],
  declined: ["requested", "declined"],
  cancelled: ["requested", "cancelled"],
};

/**
 * Realistic showcase data: neighbors across Addis Ababa, listings in every category, and loans
 * in every state (pending, upcoming, active, overdue, returned with ratings, declined,
 * cancelled), plus the loan timeline, n8n automation results (including a failure) and admin
 * audit entries. The signed-in admin becomes "you" in the data, so their dashboard has
 * incoming requests, their own borrowing and a full history.
 *
 * Replaces all listings, loans and history. Real accounts are kept.
 *   npx convex export --path backup.zip     (optional backup first)
 *   npx convex run seed:showcase '{"confirm":"replace"}'
 */
export const showcase = internalMutation({
  args: { confirm: v.literal("replace") },
  handler: async (ctx) => {
    await wipe(ctx);

    const realUsers = (await ctx.db.query("users").collect()).filter(
      (u) => !u.tokenIdentifier.startsWith("seed|"),
    );
    const me = realUsers.find((u) => u.role === "admin") ?? realUsers[0];
    if (!me) return "Sign in once (and run users:makeAdmin) before seeding the showcase.";

    const users: Record<string, Doc<"users">> = { me };
    for (const n of NEIGHBORS) {
      const id = await ctx.db.insert("users", {
        tokenIdentifier: `seed|${n.key}`,
        name: n.name,
        email: `${n.key}@example.com`,
        role: "user",
        trustedLender: n.trusted ?? false,
      });
      users[n.key] = (await ctx.db.get(id))!;
    }

    const tools: Record<string, Doc<"tools">> = {};
    for (const { key, owner, ...tool } of TOOLS) {
      const id = await ctx.db.insert("tools", { ...tool, ownerId: users[owner]._id });
      tools[key] = (await ctx.db.get(id))!;
    }

    let automations = 0;
    const automation = async (
      loanId: Id<"loans">,
      kind: Doc<"automationEvents">["kind"],
      status: Doc<"automationEvents">["status"],
      detail: string,
    ) => {
      automations++;
      await ctx.db.insert("automationEvents", {
        loanId,
        kind,
        status,
        detail,
        key: `seed:${loanId}:${kind}:${automations}`,
      });
    };

    for (const spec of LOANS) {
      const tool = tools[spec.tool];
      const owner = users[TOOLS.find((t) => t.key === spec.tool)!.owner];
      const borrower = users[spec.borrower];
      const loanId = await ctx.db.insert("loans", {
        toolId: tool._id,
        ownerId: owner._id,
        borrowerId: borrower._id,
        startDate: iso(spec.start),
        endDate: iso(spec.end),
        status: spec.status,
        note: spec.note,
        pickup: spec.pickup,
        returnedAt: spec.status === "returned" ? Date.now() + spec.end * DAY : undefined,
        searchText: [tool.name, owner.name, borrower.name].join(" "),
      });

      for (const type of EVENTS_FOR[spec.status]) {
        const actor = type === "requested" || type === "cancelled" ? borrower : owner;
        await ctx.db.insert("loanEvents", { loanId, actorId: actor._id, type });
        if (type !== "requested") {
          await automation(
            loanId,
            "notification",
            "sent",
            `Emailed ${borrower.name}: loan ${type}`,
          );
        }
      }
      if (spec.notifyFailed) {
        await automation(
          loanId,
          "notification",
          "failed",
          "n8n webhook timed out after 5 attempts with backoff; flagged for follow up",
        );
      }
      if (spec.status === "approved" && spec.end < 0) {
        await automation(
          loanId,
          "overdue_reminder",
          "sent",
          `Reminded ${borrower.name}: ${tool.name} was due ${iso(spec.end)}`,
        );
      }
      if (spec.ratings) {
        const [toBorrower, borrowerComment, toOwner, ownerComment] = spec.ratings;
        await ctx.db.insert("ratings", {
          loanId,
          raterId: owner._id,
          rateeId: borrower._id,
          rateeRole: "borrower",
          stars: toBorrower,
          comment: borrowerComment,
        });
        await ctx.db.insert("ratings", {
          loanId,
          raterId: borrower._id,
          rateeId: owner._id,
          rateeRole: "lender",
          stars: toOwner,
          comment: ownerComment,
        });
      }
    }

    await ctx.db.insert("auditLog", {
      actorId: me._id,
      action: "trusted_granted",
      targetLabel: users.selam.name,
      reason: "Lent 12 times with 5 star ratings and no late returns",
    });
    await ctx.db.insert("auditLog", {
      actorId: me._id,
      action: "trusted_granted",
      targetLabel: users.meron.name,
      reason: "Consistently on time and great reviews from borrowers",
    });
    await ctx.db.insert("auditLog", {
      actorId: me._id,
      action: "listing_removed",
      targetLabel: `Petrol chainsaw (listed by ${users.abel.name})`,
      reason: "Petrol powered cutting tools are not allowed on LendLoop for safety",
    });

    return `Showcase ready: ${NEIGHBORS.length} neighbors, ${TOOLS.length} tools, ${LOANS.length} loans, ${automations} automation results, 3 audit entries. "You" are ${me.name}.`;
  },
});
