import { internalMutation } from "./_generated/server";

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
