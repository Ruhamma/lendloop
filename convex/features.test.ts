/// <reference types="vite/client" />
import { convexTest } from "convex-test";
import { describe, expect, test } from "vitest";
import { api, internal } from "./_generated/api";
import { LIMITS } from "./lib/rateLimit";
import schema from "./schema";

const PICKUP = { kind: "meetup" as const, details: "Library entrance, Saturday 10am" };

const modules = import.meta.glob(["./**/*.ts", "./_generated/*.js", "!./**/*.test.ts"]);

const iso = (offsetDays: number) =>
  new Date(Date.now() + offsetDays * 86_400_000).toISOString().slice(0, 10);

async function setup() {
  const t = convexTest(schema, modules);
  const as = (who: string) =>
    t.withIdentity({ tokenIdentifier: `test|${who}`, name: who, email: `${who}@example.com` });
  const ana = as("ana");
  const ben = as("ben");
  const cat = as("cat");
  const admin = as("admin");
  for (const u of [ana, ben, cat, admin]) await u.mutation(api.users.store, {});
  await t.mutation(internal.users.makeAdmin, { email: "admin@example.com" });
  const drill = await ana.mutation(api.tools.create, {
    neighborhood: "Bole",
    name: "Cordless drill",
    category: "power_tools",
    condition: "good",
    description: "18V",
  });
  return { t, ana, ben, cat, admin, drill };
}

/** Ben borrows Ana's drill and returns it. */
async function finishedLoan() {
  const ctx = await setup();
  const { ana, ben, drill } = ctx;
  const loanId = await ben.mutation(api.loans.request, {
    toolId: drill,
    startDate: iso(1),
    endDate: iso(2),
    note: "  For the garden fence  ",
  });
  await ana.mutation(api.loans.decide, { loanId, approve: true, pickup: PICKUP });
  await ana.mutation(api.loans.markReturned, { loanId });
  return { ...ctx, loanId };
}

describe("loan notes and timeline", () => {
  test("the note is trimmed and the timeline records each step in order", async () => {
    const { ana, loanId } = await finishedLoan();
    const [loan] = await ana.query(api.loans.incoming, {});
    expect(loan._id).toBe(loanId);
    expect(loan.note).toBe("For the garden fence");
    const actions = loan.timeline.filter((e) => e.kind === "action").map((e) => e.type);
    expect(actions).toEqual(["requested", "approved", "returned"]);
  });
});

describe("ratings", () => {
  test("both sides can rate once after return, and the average shows on the lender", async () => {
    const { ana, ben, loanId } = await finishedLoan();
    await ben.mutation(api.ratings.rate, { loanId, stars: 5, comment: "Great drill" });
    await ana.mutation(api.ratings.rate, { loanId, stars: 4 });
    await expect(ben.mutation(api.ratings.rate, { loanId, stars: 1 })).rejects.toThrow(
      "already rated",
    );

    const tools = await ben.query(api.tools.list, {});
    expect(tools[0].ownerRating).toEqual({ average: 5, count: 1 });
    const [mine] = await ben.query(api.loans.myRequests, {});
    expect(mine).toMatchObject({ canRate: false, myRating: 5 });
  });

  test("outsiders can't rate, and nobody can rate before the return", async () => {
    const { ana, ben, cat, drill } = await setup();
    const loanId = await ben.mutation(api.loans.request, {
      toolId: drill,
      startDate: iso(1),
      endDate: iso(2),
    });
    await ana.mutation(api.loans.decide, { loanId, approve: true, pickup: PICKUP });
    await expect(ben.mutation(api.ratings.rate, { loanId, stars: 5 })).rejects.toThrow(
      "once the tool is returned",
    );
    await ana.mutation(api.loans.markReturned, { loanId });
    await expect(cat.mutation(api.ratings.rate, { loanId, stars: 1 })).rejects.toThrow(
      "loans you took part in",
    );
    await expect(ben.mutation(api.ratings.rate, { loanId, stars: 6 })).rejects.toThrow("1 to 5");
  });
});

describe("admin audit log", () => {
  test("removing someone else's listing needs a reason and is logged", async () => {
    const { admin, ben, drill } = await setup();
    await expect(admin.mutation(api.tools.remove, { toolId: drill })).rejects.toThrow(
      "A reason is required",
    );
    await admin.mutation(api.tools.remove, { toolId: drill, reason: "Duplicate listing" });

    const me = await ben.query(api.users.me, {});
    await admin.mutation(api.users.setTrustedLender, { userId: me!._id, trusted: true });

    const log = await admin.query(api.users.auditLog, {});
    expect(log.map((e) => [e.action, e.targetLabel, e.reason])).toEqual([
      ["trusted_granted", "ben", null],
      ["listing_removed", '"Cordless drill" by ana', "Duplicate listing"],
    ]);
  });

  test("only admins can read the audit log", async () => {
    const { ana } = await setup();
    await expect(ana.query(api.users.auditLog, {})).rejects.toThrow("Admins only");
  });
});

describe("rate limiting", () => {
  test("borrow requests are capped per user per hour", async () => {
    const { ben, cat, ana } = await setup();
    const tools = [];
    for (let i = 0; i < LIMITS.requestLoan.max + 1; i++) {
      tools.push(
        await ana.mutation(api.tools.create, {
          neighborhood: "Bole",
          name: `Tool ${i}`,
          category: "other",
          condition: "good",
          description: "x",
        }),
      );
    }
    for (let i = 0; i < LIMITS.requestLoan.max; i++) {
      await ben.mutation(api.loans.request, {
        toolId: tools[i],
        startDate: iso(1),
        endDate: iso(2),
      });
    }
    await expect(
      ben.mutation(api.loans.request, {
        toolId: tools[LIMITS.requestLoan.max],
        startDate: iso(1),
        endDate: iso(2),
      }),
    ).rejects.toThrow("too often");
    // The limit is per user: a different neighbor is unaffected.
    await cat.mutation(api.loans.request, { toolId: tools[0], startDate: iso(1), endDate: iso(2) });
  });
});

describe("tool photos", () => {
  test("images are accepted, other file types are rejected and deleted", async () => {
    const { t, ana } = await setup();
    const image = await t.run((ctx) =>
      ctx.storage.store(new Blob([new Uint8Array([1, 2, 3])], { type: "image/png" })),
    );
    const script = await t.run((ctx) =>
      ctx.storage.store(new Blob(["alert(1)"], { type: "text/html" })),
    );

    const toolId = await ana.mutation(api.tools.create, {
      neighborhood: "Bole",
      name: "Ladder",
      category: "hand_tools",
      condition: "good",
      description: "6 ft",
      photoId: image,
    });
    const tool = await ana.query(api.tools.get, { toolId });
    expect(tool?.photoUrl).toEqual(expect.any(String));

    await expect(
      ana.mutation(api.tools.create, {
        neighborhood: "Bole",
        name: "Bad",
        category: "other",
        condition: "good",
        description: "x",
        photoId: script,
      }),
    ).rejects.toThrow("JPEG, PNG or WebP");
    // The daily cleanup deletes the rejected upload but keeps the attached photo.
    await t.mutation(internal.storage.deleteUnattachedFiles, { olderThanMs: 0 });
    expect(await t.run((ctx) => ctx.db.system.get(script))).toBeNull();
    expect(await t.run((ctx) => ctx.db.system.get(image))).not.toBeNull();
  });

  test("a photo can't be attached to two listings", async () => {
    const { t, ana, ben } = await setup();
    const image = await t.run((ctx) =>
      ctx.storage.store(new Blob([new Uint8Array([1])], { type: "image/jpeg" })),
    );
    await ana.mutation(api.tools.create, {
      neighborhood: "Bole",
      name: "Ladder",
      category: "hand_tools",
      condition: "good",
      description: "6 ft",
      photoId: image,
    });
    await expect(
      ben.mutation(api.tools.create, {
        neighborhood: "Bole",
        name: "Copy",
        category: "other",
        condition: "good",
        description: "x",
        photoId: image,
      }),
    ).rejects.toThrow("belongs to another listing");
  });
});

describe("tool detail", () => {
  test("a malformed id from the URL is treated as not found", async () => {
    const { ana } = await setup();
    expect(await ana.query(api.tools.get, { toolId: "not-an-id" })).toBeNull();
  });

  test("only the owner sees who booked the tool", async () => {
    const { ana, ben, cat, drill } = await setup();
    const loanId = await ben.mutation(api.loans.request, {
      toolId: drill,
      startDate: iso(3),
      endDate: iso(5),
    });
    await ana.mutation(api.loans.decide, { loanId, approve: true, pickup: PICKUP });

    const asOwner = await ana.query(api.tools.get, { toolId: drill });
    const asNeighbor = await cat.query(api.tools.get, { toolId: drill });
    expect(asOwner?.bookings).toEqual([
      { startDate: iso(3), endDate: iso(5), borrowerName: "ben" },
    ]);
    expect(asNeighbor?.bookings).toEqual([
      { startDate: iso(3), endDate: iso(5), borrowerName: null },
    ]);
  });
});

describe("pickup details (staged disclosure)", () => {
  test("only the approved borrower sees pickup details, and only while the loan is active", async () => {
    const { ana, ben, cat, admin, drill } = await setup();
    const loanId = await ben.mutation(api.loans.request, {
      toolId: drill,
      startDate: iso(1),
      endDate: iso(2),
    });
    // Pending: the borrower doesn't know where to go yet.
    expect((await ben.query(api.loans.myRequests, {}))[0].pickup).toBeNull();

    await expect(ana.mutation(api.loans.decide, { loanId, approve: true })).rejects.toThrow(
      "Add pickup details",
    );
    await ana.mutation(api.loans.decide, { loanId, approve: true, pickup: PICKUP });

    expect((await ben.query(api.loans.myRequests, {}))[0].pickup).toEqual(PICKUP);
    expect((await ana.query(api.loans.incoming, {}))[0].pickup).toEqual(PICKUP);
    // Admins moderate, they don't need to know where people live.
    expect((await admin.query(api.loans.all, {}))[0].pickup).toBeNull();
    // Other neighbors only ever see the coarse neighborhood.
    const asNeighbor = await cat.query(api.tools.get, { toolId: drill });
    expect(asNeighbor?.neighborhood).toBe("Bole");
    expect(JSON.stringify(asNeighbor)).not.toContain("Library");

    await ana.mutation(api.loans.markReturned, { loanId });
    expect((await ben.query(api.loans.myRequests, {}))[0].pickup).toBeNull();
    const stored = await ana.run((ctx) => ctx.db.get(loanId));
    expect(stored?.pickup).toBeUndefined();
  });

  test("pickup details never go to n8n", async () => {
    const { t, ana, ben, drill } = await setup();
    const loanId = await ben.mutation(api.loans.request, {
      toolId: drill,
      startDate: iso(1),
      endDate: iso(2),
    });
    await ana.mutation(api.loans.decide, { loanId, approve: true, pickup: PICKUP });
    const payload = await t.query(internal.notify.loanEventPayload, {
      loanId,
      recipient: "borrower",
    });
    expect(payload?.status).toBe("approved");
    expect(JSON.stringify(payload)).not.toContain("Library");
  });

  test("only the owner can change pickup details", async () => {
    const { ana, ben, drill } = await setup();
    const loanId = await ben.mutation(api.loans.request, {
      toolId: drill,
      startDate: iso(1),
      endDate: iso(2),
    });
    await ana.mutation(api.loans.decide, { loanId, approve: true, pickup: PICKUP });
    const moved = { kind: "home" as const, details: "Blue gate, call on arrival" };
    await expect(ben.mutation(api.loans.updatePickup, { loanId, pickup: moved })).rejects.toThrow(
      "Only the tool's owner",
    );
    await ana.mutation(api.loans.updatePickup, { loanId, pickup: moved });
    expect((await ben.query(api.loans.myRequests, {}))[0].pickup).toEqual(moved);
  });
});

describe("collection queries (pagination, search, filters)", () => {
  const page = (n: number, cursor: string | null = null) => ({ numItems: n, cursor });

  test("tools.browse pages through results and searches by name", async () => {
    const { ana, ben } = await setup();
    for (const name of ["Ladder", "Hedge trimmer", "Tent", "Leaf blower"]) {
      await ana.mutation(api.tools.create, {
        name,
        neighborhood: "Bole",
        category: name === "Tent" ? "camping" : "garden",
        condition: "good",
        description: "x",
      });
    }
    // setup() already listed a drill, so there are 5 tools.
    const first = await ben.query(api.tools.browse, { paginationOpts: page(2) });
    expect(first.page).toHaveLength(2);
    expect(first.isDone).toBe(false);
    const rest = await ben.query(api.tools.browse, {
      paginationOpts: page(10, first.continueCursor),
    });
    expect(first.page.length + rest.page.length).toBe(5);

    const hits = await ben.query(api.tools.browse, { search: "ladder", paginationOpts: page(10) });
    expect(hits.page.map((t) => t.name)).toEqual(["Ladder"]);

    const camping = await ben.query(api.tools.browse, {
      category: "camping",
      paginationOpts: page(10),
    });
    expect(camping.page.map((t) => t.name)).toEqual(["Tent"]);

    const byName = await ben.query(api.tools.browse, { sort: "name", paginationOpts: page(10) });
    expect(byName.page.map((t) => t.name)).toEqual([...byName.page.map((t) => t.name)].sort());
  });

  test("mine only returns the viewer's tools", async () => {
    const { ben } = await setup();
    await ben.mutation(api.tools.create, {
      name: "Tent",
      neighborhood: "Bole",
      category: "camping",
      condition: "good",
      description: "x",
    });
    const mine = await ben.query(api.tools.browse, { mine: true, paginationOpts: page(10) });
    expect(mine.page.map((t) => [t.name, t.isMine])).toEqual([["Tent", true]]);
  });

  test("cards show the next booking (dates only)", async () => {
    const { t, ana, ben, drill } = await setup();
    const loanId = await ben.mutation(api.loans.request, {
      toolId: drill,
      startDate: iso(5),
      endDate: iso(7),
    });
    await ana.mutation(api.loans.decide, { loanId, approve: true, pickup: PICKUP });
    const [pub] = await t.query(api.tools.publicList, {});
    expect(pub.nextBooking).toEqual({ startDate: iso(5), endDate: iso(7) });
    expect(JSON.stringify(pub)).not.toContain("ben");
  });

  test("loans.page filters by status, and only admins can list every loan", async () => {
    const { ana, ben, admin, drill } = await setup();
    const a = await ben.mutation(api.loans.request, {
      toolId: drill,
      startDate: iso(1),
      endDate: iso(2),
    });
    await ana.mutation(api.loans.decide, { loanId: a, approve: true, pickup: PICKUP });
    const tent = await ana.mutation(api.tools.create, {
      name: "Tent",
      neighborhood: "Bole",
      category: "camping",
      condition: "good",
      description: "x",
    });
    await ben.mutation(api.loans.request, { toolId: tent, startDate: iso(3), endDate: iso(4) });

    const pending = await ben.query(api.loans.page, {
      role: "borrower",
      status: "pending",
      paginationOpts: page(10),
    });
    expect(pending.page.map((l) => l.toolName)).toEqual(["Tent"]);
    const incoming = await ana.query(api.loans.page, { role: "owner", paginationOpts: page(10) });
    expect(incoming.page).toHaveLength(2);

    await expect(
      ben.query(api.loans.page, { role: "all", paginationOpts: page(10) }),
    ).rejects.toThrow("Admins only");
    const all = await admin.query(api.loans.page, { role: "all", paginationOpts: page(10) });
    expect(all.page).toHaveLength(2);
  });
});

describe("admin activity log", () => {
  test("merges admin actions, loan changes and automations; admins only", async () => {
    const { t, ana, ben, admin, drill } = await setup();
    const loanId = await ben.mutation(api.loans.request, {
      toolId: drill,
      startDate: iso(1),
      endDate: iso(2),
    });
    await t.mutation(internal.automation.record, {
      loanId,
      kind: "notification",
      status: "sent",
      key: `notify:${loanId}:pending:owner`,
    });
    const me = await ben.query(api.users.me, {});
    await admin.mutation(api.users.setTrustedLender, { userId: me!._id, trusted: true });

    await expect(
      ana.query(api.activity.feed, { kind: "all", offset: 0, pageSize: 10 }),
    ).rejects.toThrow("Admins only");
    const all = await admin.query(api.activity.feed, { kind: "all", offset: 0, pageSize: 10 });
    expect(new Set(all.entries.map((e) => e.kind))).toEqual(
      new Set(["admin", "loan", "automation"]),
    );
    const onlyAdmin = await admin.query(api.activity.feed, {
      kind: "admin",
      offset: 0,
      pageSize: 10,
    });
    expect(onlyAdmin.entries.every((e) => e.kind === "admin")).toBe(true);
  });
});

describe("admin search", () => {
  const page = (n: number) => ({ numItems: n, cursor: null });

  test("all loans can be searched by tool, borrower or owner name", async () => {
    const { ana, ben, admin, drill } = await setup();
    const loanId = await ben.mutation(api.loans.request, {
      toolId: drill,
      startDate: iso(1),
      endDate: iso(2),
    });
    for (const term of ["drill", "ben", "ana"]) {
      const hits = await admin.query(api.loans.page, {
        role: "all",
        search: term,
        paginationOpts: page(10),
      });
      expect(hits.page.map((l) => l._id)).toEqual([loanId]);
    }
    const none = await admin.query(api.loans.page, {
      role: "all",
      search: "kayak",
      paginationOpts: page(10),
    });
    expect(none.page).toHaveLength(0);
    // A borrower's search never reaches other people's loans.
    const asAna = await ana.query(api.loans.page, {
      role: "borrower",
      search: "drill",
      paginationOpts: page(10),
    });
    expect(asAna.page).toHaveLength(0);
  });

  test("neighbors are searchable by name, admins only", async () => {
    const { ana, admin } = await setup();
    const hits = await admin.query(api.users.page, { search: "ben", paginationOpts: page(10) });
    expect(hits.page.map((u) => u.name)).toEqual(["ben"]);
    await expect(ana.query(api.users.page, { paginationOpts: page(10) })).rejects.toThrow(
      "Admins only",
    );
  });

  test("the audit log pages by offset without repeating entries", async () => {
    const { ana, ben, admin, drill } = await setup();
    for (let i = 0; i < 3; i++) {
      const loanId = await ben.mutation(api.loans.request, {
        toolId: drill,
        startDate: iso(10 + i * 3),
        endDate: iso(11 + i * 3),
      });
      await ana.mutation(api.loans.decide, { loanId, approve: false });
    }
    const first = await admin.query(api.activity.feed, { kind: "loan", offset: 0, pageSize: 4 });
    const second = await admin.query(api.activity.feed, { kind: "loan", offset: 4, pageSize: 4 });
    expect(first.entries).toHaveLength(4);
    expect(first.hasMore).toBe(true);
    expect(second.entries).toHaveLength(2);
    expect(second.hasMore).toBe(false);
    const ids = [...first.entries, ...second.entries].map((e) => e.id);
    expect(new Set(ids).size).toBe(6);
  });
});
