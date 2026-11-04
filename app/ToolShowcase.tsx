"use client";

import { useQuery } from "convex/react";
import { ArrowUpRight, CalendarCheck, CalendarClock, Tag } from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { api } from "@/convex/_generated/api";
import { CATEGORY_LABELS } from "@/convex/lib/constants";
import { CATEGORY_DOORS, CATEGORY_ICONS } from "./components/categoryIcons";

const formatDay = (iso: string) =>
  new Date(`${iso}T00:00:00Z`).toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    timeZone: "UTC",
  });

/**
 * Available tools as booking-style cards in a centered grid (up to eight; the dashboard has
 * the rest). Public data only: name and category, never the owner.
 */
export function ToolShowcase() {
  const tools = useQuery(api.tools.publicList);

  if (tools === undefined) {
    return (
      <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-4" aria-busy="true">
        {[0, 1, 2, 3].map((i) => (
          <div key={i} className="h-[23rem] animate-pulse rounded-[1.75rem] bg-paper" />
        ))}
      </div>
    );
  }
  if (tools.length === 0) {
    return (
      <div className="mx-auto flex max-w-md flex-col items-center text-center">
        <Image src="/mascot/pip-tape-measure.png" alt="" width={220} height={153} />
        <p className="mt-4 text-ink-soft">No tools listed yet. Be the first to lend one.</p>
      </div>
    );
  }

  return (
    <ul className="grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
      {tools.slice(0, 8).map((tool, i) => {
        const Icon = CATEGORY_ICONS[tool.category];
        return (
          <li key={tool._id} style={{ "--i": i } as React.CSSProperties} className="rise-in group">
            <Link
              href={`/dashboard/tools/${tool._id}`}
              className="flex h-full flex-col rounded-[1.75rem] bg-surface p-2 shadow-[0_1px_2px_rgb(0_0_0/0.04),0_8px_24px_rgb(0_0_0/0.08)] ring-1 ring-black/5 transition duration-300 hover:-translate-y-1 hover:shadow-[0_2px_4px_rgb(0_0_0/0.05),0_16px_40px_rgb(0_0_0/0.12)]"
            >
              <div
                className={`relative flex aspect-square items-center justify-center overflow-hidden rounded-[1.4rem] ${CATEGORY_DOORS[tool.category]}`}
              >
                <Icon
                  className="h-20 w-20 text-ink/80 transition-transform duration-500 group-hover:-rotate-6 group-hover:scale-110"
                  strokeWidth={1.3}
                  aria-hidden
                />
                <span className="absolute left-3 top-3 inline-flex items-center gap-1.5 rounded-full bg-white/90 px-3 py-1 text-xs font-semibold text-ok backdrop-blur">
                  <span className="h-1.5 w-1.5 rounded-full bg-ok" aria-hidden />
                  Available now
                </span>
                <span className="absolute right-3 top-3 flex h-9 w-9 items-center justify-center rounded-full bg-white/70 text-ink backdrop-blur transition-colors group-hover:bg-white">
                  <ArrowUpRight className="h-4 w-4" aria-hidden />
                </span>
              </div>
              <div className="flex flex-1 flex-col px-3 pb-2 pt-4">
                <h3 className="font-sans text-xl font-semibold leading-tight tracking-tight">
                  {tool.name}
                </h3>
                {tool.nextBooking && (
                  <p className="mt-2 inline-flex items-center gap-1.5 text-xs font-medium text-warn">
                    <CalendarClock className="h-3.5 w-3.5" aria-hidden />
                    Booked {formatDay(tool.nextBooking.startDate)}–
                    {formatDay(tool.nextBooking.endDate)}
                  </p>
                )}
                <p className="mt-2 flex items-center gap-4 text-sm text-muted">
                  <span className="inline-flex items-center gap-1.5">
                    <Tag className="h-3.5 w-3.5" aria-hidden />
                    {CATEGORY_LABELS[tool.category]}
                  </span>
                  <span className="inline-flex items-center gap-1.5">
                    <CalendarCheck className="h-3.5 w-3.5" aria-hidden />
                    Free to borrow
                  </span>
                </p>
                <span className="mt-5 inline-flex items-center justify-center rounded-full bg-zinc-950 px-5 py-3 text-sm font-medium text-white transition-colors group-hover:bg-brand">
                  Borrow this
                </span>
              </div>
            </Link>
          </li>
        );
      })}
    </ul>
  );
}
