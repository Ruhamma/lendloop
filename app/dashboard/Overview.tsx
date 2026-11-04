"use client";

import { useQuery } from "convex/react";
import { ArrowUpRight, Inbox, Package, Repeat, Send } from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { api } from "@/convex/_generated/api";
import { EntityTable } from "./EntityTable";
import { Empty, LoanStatusBadge, Loading, Stars, formatDate } from "./ui";

function greeting() {
  const h = new Date().getHours();
  return h < 12 ? "Good morning" : h < 18 ? "Good afternoon" : "Good evening";
}

/** Dashboard home: four stat cards, requests that need you, and your standing as a lender. */
export function Overview({ name }: { name: string }) {
  const mine = useQuery(api.tools.mine);
  const incoming = useQuery(api.loans.incoming);
  const requests = useQuery(api.loans.myRequests);
  const me = useQuery(api.users.me);

  if (!mine || !incoming || !requests) return <Loading />;

  const toReview = incoming.filter((l) => l.status === "pending");
  const lentOut = incoming.filter((l) => l.status === "approved");
  const borrowing = requests.filter((l) => l.status === "approved");
  const overdue = [...lentOut, ...borrowing].filter((l) => l.overdue).length;

  const stats = [
    {
      label: "Tools listed",
      value: mine.length,
      hint: `${mine.filter((t) => t.availability.status === "available").length} available now`,
      icon: Package,
      tone: "bg-sun",
      href: "/dashboard?tab=listings",
    },
    {
      label: "Lent out now",
      value: lentOut.length,
      hint: overdue ? `${overdue} overdue` : "All on time",
      icon: Repeat,
      tone: "bg-sky",
      href: "/dashboard?tab=incoming",
    },
    {
      label: "Requests to review",
      value: toReview.length,
      hint: toReview.length ? "Neighbors are waiting" : "You're all caught up",
      icon: Inbox,
      tone: "bg-coral",
      href: "/dashboard?tab=incoming",
    },
    {
      label: "Borrowing now",
      value: borrowing.length,
      hint: `${requests.filter((l) => l.status === "pending").length} pending requests`,
      icon: Send,
      tone: "bg-lav",
      href: "/dashboard?tab=requests",
    },
  ];

  const recent = incoming.slice(0, 5);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl">
          {greeting()}, {name.split(" ")[0]}
        </h1>
        <p className="mt-1 text-ink-soft">Here&apos;s what&apos;s happening on your street.</p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {stats.map((s) => (
          <Link
            key={s.label}
            href={s.href}
            className="group rounded-2xl bg-white p-5 ring-1 ring-black/5 transition-shadow hover:shadow-card"
          >
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium text-ink-soft">{s.label}</span>
              <span
                className={`flex h-8 w-8 items-center justify-center rounded-lg text-ink ${s.tone}`}
              >
                <s.icon className="h-4 w-4" aria-hidden />
              </span>
            </div>
            <p className="mt-3 font-sans text-3xl font-semibold tracking-tight">{s.value}</p>
            <p className="mt-1 text-xs text-muted">{s.hint}</p>
          </Link>
        ))}
      </div>

      <div className="grid gap-6 lg:grid-cols-[1fr_320px]">
        <section className="rounded-2xl bg-white ring-1 ring-black/5">
          <div className="flex items-center justify-between px-5 pt-5">
            <h2 className="font-sans text-base font-semibold">Requests for your tools</h2>
            <Link
              href="/dashboard?tab=incoming"
              className="inline-flex items-center gap-1 text-sm font-medium text-brand hover:underline"
            >
              View all <ArrowUpRight className="h-3.5 w-3.5" aria-hidden />
            </Link>
          </div>
          {recent.length === 0 ? (
            <div className="p-5">
              <Empty>No one has asked to borrow your tools yet.</Empty>
            </div>
          ) : (
            <div className="p-2">
              <EntityTable
                rows={recent}
                rowKey={(l) => l._id}
                caption="Requests for your tools"
                minWidth={560}
                columns={[
                  {
                    key: "tool",
                    header: "Tool",
                    className: "font-medium",
                    cell: (l) => l.toolName,
                  },
                  {
                    key: "borrower",
                    header: "Borrower",
                    className: "text-ink-soft",
                    cell: (l) => l.borrowerName,
                  },
                  {
                    key: "dates",
                    header: "Dates",
                    className: "whitespace-nowrap text-ink-soft",
                    cell: (l) => `${formatDate(l.startDate)} – ${formatDate(l.endDate)}`,
                  },
                  {
                    key: "status",
                    header: "Status",
                    cell: (l) => <LoanStatusBadge status={l.status} overdue={l.overdue} />,
                  },
                ]}
              />
            </div>
          )}
        </section>

        <section className="flex flex-col items-center rounded-2xl bg-white p-6 text-center ring-1 ring-black/5">
          <Image src="/mascot/pip-waving.png" alt="" width={110} height={120} />
          <h2 className="mt-3 font-sans text-base font-semibold">Your standing</h2>
          {me?.rating ? (
            <>
              <div className="mt-2 scale-125">
                <Stars value={me.rating.average} count={me.rating.count} />
              </div>
              <p className="mt-3 text-sm text-ink-soft">Rated by neighbors after real loans.</p>
            </>
          ) : (
            <p className="mt-2 text-sm text-ink-soft">
              No ratings yet. They appear after your first finished loan.
            </p>
          )}
          {me?.trustedLender && (
            <span className="mt-4 rounded-full bg-sun px-3 py-1 text-xs font-semibold text-ink">
              Trusted Lender
            </span>
          )}
        </section>
      </div>
    </div>
  );
}
