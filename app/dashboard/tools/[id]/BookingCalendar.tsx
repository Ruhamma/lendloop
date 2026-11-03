"use client";

type Booking = { startDate: string; endDate: string; borrowerName: string | null };

const WEEKDAYS = ["Mo", "Tu", "We", "Th", "Fr", "Sa", "Su"];

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

/**
 * Two months of availability: booked days are shaded, the selected range is highlighted,
 * and past days are faded. Purely visual; the server re-checks every request.
 */
export function BookingCalendar({
  bookings,
  selectedStart,
  selectedEnd,
}: {
  bookings: Booking[];
  selectedStart?: string;
  selectedEnd?: string;
}) {
  const now = new Date();
  const today = iso(now);
  const months = [0, 1].map((offset) => {
    const d = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + offset, 1));
    return { year: d.getUTCFullYear(), month: d.getUTCMonth() };
  });
  const booked = (day: string) => bookings.find((b) => b.startDate <= day && day <= b.endDate);
  const selected = (day: string) =>
    !!selectedStart && day >= selectedStart && day <= (selectedEnd || selectedStart);

  return (
    <div>
      <div className="grid gap-6 sm:grid-cols-2">
        {months.map(({ year, month }) => (
          <div key={`${year}-${month}`}>
            <p className="mb-2 text-sm font-medium">
              {new Date(Date.UTC(year, month)).toLocaleDateString(undefined, {
                month: "long",
                year: "numeric",
                timeZone: "UTC",
              })}
            </p>
            <div className="grid grid-cols-7 gap-1 text-center text-xs">
              {WEEKDAYS.map((d) => (
                <span key={d} className="text-muted">
                  {d}
                </span>
              ))}
              {monthGrid(year, month).map((day, i) => {
                if (!day) return <span key={`pad-${i}`} />;
                const booking = booked(day);
                const tone = booking
                  ? "bg-warn-soft text-warn"
                  : selected(day)
                    ? "bg-brand text-white"
                    : day < today
                      ? "text-muted/40"
                      : "text-ink";
                return (
                  <span
                    key={day}
                    title={
                      booking
                        ? `Booked${booking.borrowerName ? ` by ${booking.borrowerName}` : ""}`
                        : undefined
                    }
                    className={`rounded py-1 ${tone} ${day === today ? "ring-1 ring-brand" : ""}`}
                  >
                    {Number(day.slice(8))}
                  </span>
                );
              })}
            </div>
          </div>
        ))}
      </div>
      <div className="mt-3 flex gap-4 text-xs text-muted">
        <span>
          <span className="mr-1 inline-block h-3 w-3 rounded bg-warn-soft align-middle" /> Booked
        </span>
        <span>
          <span className="mr-1 inline-block h-3 w-3 rounded bg-brand align-middle" /> Your dates
        </span>
      </div>
    </div>
  );
}
