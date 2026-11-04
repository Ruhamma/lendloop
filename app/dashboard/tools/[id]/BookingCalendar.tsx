"use client";

import { ChevronLeft, ChevronRight } from "lucide-react";
import { useState } from "react";

type Booking = { startDate: string; endDate: string; borrowerName: string | null };

const WEEKDAYS = ["Mo", "Tu", "We", "Th", "Fr", "Sa", "Su"];
const MAX_MONTHS_AHEAD = 12;

const iso = (d: Date) => d.toISOString().slice(0, 10);

/** Days of one month as ISO dates, padded so weeks start on Monday. */
function monthGrid(year: number, month: number) {
  const first = new Date(Date.UTC(year, month, 1));
  const days = new Date(Date.UTC(year, month + 1, 0)).getUTCDate();
  const pad = (first.getUTCDay() + 6) % 7;
  return [
    ...Array<null>(pad).fill(null),
    ...Array.from({ length: days }, (_, i) => iso(new Date(Date.UTC(year, month, i + 1)))),
  ];
}

const monthName = (y: number, m: number) =>
  new Date(Date.UTC(y, m)).toLocaleDateString(undefined, {
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  });

/**
 * Two months of availability with navigation up to a year ahead. Booked days are shaded and
 * can't be picked; when `onPick` is given, clicking days chooses the start and end dates.
 * Purely a helper: the server re-checks every request.
 */
export function BookingCalendar({
  bookings,
  selectedStart,
  selectedEnd,
  onPick,
}: {
  bookings: Booking[];
  selectedStart?: string;
  selectedEnd?: string;
  onPick?: (day: string) => void;
}) {
  const now = new Date();
  const today = iso(now);
  const [offset, setOffset] = useState(0);
  const months = [offset, offset + 1].map((o) => {
    const d = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + o, 1));
    return { year: d.getUTCFullYear(), month: d.getUTCMonth() };
  });
  const booked = (day: string) => bookings.find((b) => b.startDate <= day && day <= b.endDate);
  const selected = (day: string) =>
    !!selectedStart && day >= selectedStart && day <= (selectedEnd || selectedStart);

  return (
    <div>
      <div className="mb-4 flex items-center justify-between">
        <button
          type="button"
          aria-label="Previous months"
          disabled={offset === 0}
          onClick={() => setOffset((o) => o - 1)}
          className="flex h-9 w-9 items-center justify-center rounded-full ring-1 ring-black/10 hover:bg-paper disabled:opacity-30"
        >
          <ChevronLeft className="h-4 w-4" />
        </button>
        <p className="text-sm font-medium text-ink-soft" aria-live="polite">
          {monthName(months[0].year, months[0].month)} –{" "}
          {monthName(months[1].year, months[1].month)}
        </p>
        <button
          type="button"
          aria-label="Next months"
          disabled={offset >= MAX_MONTHS_AHEAD - 1}
          onClick={() => setOffset((o) => o + 1)}
          className="flex h-9 w-9 items-center justify-center rounded-full ring-1 ring-black/10 hover:bg-paper disabled:opacity-30"
        >
          <ChevronRight className="h-4 w-4" />
        </button>
      </div>

      <div className="grid gap-8 sm:grid-cols-2">
        {months.map(({ year, month }) => (
          <div key={`${year}-${month}`}>
            <p className="mb-2 text-sm font-semibold">{monthName(year, month)}</p>
            <div className="grid grid-cols-7 gap-1 text-center text-xs">
              {WEEKDAYS.map((d) => (
                <span key={d} className="pb-1 text-muted">
                  {d}
                </span>
              ))}
              {monthGrid(year, month).map((day, i) => {
                if (!day) return <span key={`pad-${i}`} />;
                const booking = booked(day);
                const past = day < today;
                const tone = booking
                  ? "bg-warn-soft text-warn line-through"
                  : selected(day)
                    ? "bg-brand text-white"
                    : past
                      ? "text-muted/40"
                      : onPick
                        ? "text-ink hover:bg-brand-soft"
                        : "text-ink";
                return (
                  <button
                    key={day}
                    type="button"
                    disabled={past || !!booking || !onPick}
                    onClick={() => onPick?.(day)}
                    title={
                      booking
                        ? `Booked${booking.borrowerName ? ` by ${booking.borrowerName}` : ""}`
                        : undefined
                    }
                    aria-label={`${day}${booking ? ", booked" : past ? ", past" : ""}`}
                    className={`rounded-lg py-1.5 transition-colors duration-200 disabled:cursor-default ${tone} ${
                      day === today ? "ring-1 ring-brand" : ""
                    }`}
                  >
                    {Number(day.slice(8))}
                  </button>
                );
              })}
            </div>
          </div>
        ))}
      </div>

      <div className="mt-4 flex flex-wrap gap-4 text-xs text-muted">
        <span>
          <span className="mr-1 inline-block h-3 w-3 rounded bg-warn-soft align-middle" /> Already
          booked
        </span>
        <span>
          <span className="mr-1 inline-block h-3 w-3 rounded bg-brand align-middle" /> Your dates
        </span>
        <span>
          <span className="mr-1 inline-block h-3 w-3 rounded align-middle ring-1 ring-brand" />{" "}
          Today
        </span>
      </div>
    </div>
  );
}
