/// <reference types="vite/client" />
import { convexTest } from "convex-test";
import { describe, expect, test } from "vitest";
import { api, internal } from "./_generated/api";
import schema from "./schema";

const PICKUP = { kind: "meetup" as const, details: "Library entrance, Saturday 10am" };

const modules = import.meta.glob(["./**/*.ts", "./_generated/*.js", "!./**/*.test.ts"]);

const iso = (offsetDays: number) =>
  new Date(Date.now() + offsetDays * 86_400_000).toISOString().slice(0, 10);

/** Two neighbors and an admin, each signed in through the same path the app uses. */
async function setup() {
  const t = convexTest(schema, modules);
  const as = (who: string) =>
    t.withIdentity({ tokenIdentifier: `test|${who}`, name: who, email: `${who}@example.com` });
  const ana = as("ana");
  const ben = as("ben");
  const admin = as("admin");
  await ana.mutation(api.users.store, {});
  await ben.mutation(api.users.store, {});
  await admin.mutation(api.users.store, {});
  await t.mutation(internal.users.makeAdmin, { email: "admin@example.com" });

  const drill = await ana.mutation(api.tools.create, {
    neighborhood: "Bole",
    name: "Cordless drill",
    category: "power_tools",
    condition: "good",
    description: "18V",
  });
  return { t, ana, ben, admin, drill };
}

describe("public page", () => {
  test("anonymous visitors see name, category and booked dates only, never the owner", async () => {
    const { t } = await setup();
    const tools = await t.query(api.tools.publicList, {});
    expect(tools).toEqual([
      {
        _id: expect.any(String),
        name: "Cordless drill",
        category: "power_tools",
        nextBooking: null,
      },
    ]);
  });

  test("signed-in views reject anonymous callers", async () => {
    const { t } = await setup();
    await expect(t.query(api.tools.list, {})).rejects.toThrow("Not signed in");
  });
});

describe("listings", () => {
  test("users can't edit or delete someone else's tool", async () => {
    const { ben, drill } = await setup();
    await expect(
      ben.mutation(api.tools.update, {
        neighborhood: "Bole",
        toolId: drill,
        name: "Mine now",
        category: "garden",
        condition: "worn",
        description: "x",
      }),
    ).rejects.toThrow("only edit your own");
    await expect(ben.mutation(api.tools.remove, { toolId: drill })).rejects.toThrow(
      "only delete your own",
    );
  });

  test("admins can remove any listing", async () => {
    const { t, admin, drill } = await setup();
    await admin.mutation(api.tools.remove, { toolId: drill, reason: "Spam" });
    expect(await t.query(api.tools.publicList, {})).toEqual([]);
  });
});

describe("loans", () => {
  test("only the tool's owner can approve, and only the borrower can cancel", async () => {
    const { ana, ben, admin, drill } = await setup();
    const loanId = await ben.mutation(api.loans.request, {
      toolId: drill,
      startDate: iso(1),
      endDate: iso(3),
    });

    await expect(
      ben.mutation(api.loans.decide, { loanId, approve: true, pickup: PICKUP }),
    ).rejects.toThrow("Only the tool's owner");
    await expect(
      admin.mutation(api.loans.decide, { loanId, approve: true, pickup: PICKUP }),
    ).rejects.toThrow("Only the tool's owner");
    await expect(ana.mutation(api.loans.cancel, { loanId })).rejects.toThrow(
      "only cancel your own",
    );

    await ana.mutation(api.loans.decide, { loanId, approve: true, pickup: PICKUP });
    const [mine] = await ben.query(api.loans.myRequests, {});
    expect(mine.status).toBe("approved");
  });

  test("approved loans block overlapping requests", async () => {
    const { ana, ben, admin, drill } = await setup();
    const loanId = await ben.mutation(api.loans.request, {
      toolId: drill,
      startDate: iso(1),
      endDate: iso(5),
    });
    await ana.mutation(api.loans.decide, { loanId, approve: true, pickup: PICKUP });
    await expect(
      admin.mutation(api.loans.request, { toolId: drill, startDate: iso(4), endDate: iso(6) }),
    ).rejects.toThrow("already booked");
  });

  test("owners can't borrow their own tool", async () => {
    const { ana, drill } = await setup();
    await expect(
      ana.mutation(api.loans.request, { toolId: drill, startDate: iso(1), endDate: iso(2) }),
    ).rejects.toThrow("your own tool");
  });
});

describe("admin", () => {
  test("only admins can see all loans or mark Trusted Lenders", async () => {
    const { ana, ben, admin } = await setup();
    const me = await ben.query(api.users.me, {});
    await expect(ana.query(api.loans.all, {})).rejects.toThrow("Admins only");
    await expect(
      ana.mutation(api.users.setTrustedLender, { userId: me!._id, trusted: true }),
    ).rejects.toThrow("Admins only");

    await admin.mutation(api.users.setTrustedLender, { userId: me!._id, trusted: true });
    expect((await ben.query(api.users.me, {}))!.trustedLender).toBe(true);
  });
});

describe("automation write-backs", () => {
  test("recording the same key twice keeps one row", async () => {
    const { t, ana, ben, drill } = await setup();
    const loanId = await ben.mutation(api.loans.request, {
      toolId: drill,
      startDate: iso(1),
      endDate: iso(2),
    });
    await ana.mutation(api.loans.decide, { loanId, approve: true, pickup: PICKUP });
    const event = {
      loanId,
      kind: "overdue_reminder" as const,
      status: "sent" as const,
      key: `overdue:${loanId}:${iso(0)}`,
    };
    await t.mutation(internal.automation.record, event);
    expect(await t.mutation(internal.automation.record, event)).toEqual({ duplicate: true });
    const rows = await t.run((ctx) => ctx.db.query("automationEvents").collect());
    expect(rows.filter((r) => r.kind === "overdue_reminder")).toHaveLength(1);
  });

  test("n8n endpoints reject unsigned requests", async () => {
    process.env.N8N_TO_CONVEX_SECRET = "test-secret";
    const { t } = await setup();
    const res = await t.fetch("/n8n/overdue-loans", { method: "GET" });
    expect(res.status).toBe(401);
  });
});
