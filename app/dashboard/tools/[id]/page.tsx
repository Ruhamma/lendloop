"use client";

import { useMutation, useQuery } from "convex/react";
import { ArrowLeft, BadgeCheck, CalendarCheck, MapPin, ShieldCheck, Tag } from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useState } from "react";
import { api } from "@/convex/_generated/api";
import { CATEGORY_LABELS } from "@/convex/lib/constants";
import { BookingNote, ToolArt } from "../../BrowseTools";
import {
  AvailabilityBadge,
  Button,
  ErrorText,
  Loading,
  Stars,
  formatDate,
  inputClass,
  useAction,
} from "../../ui";
import { BookingCalendar } from "./BookingCalendar";

const nextDay = (iso: string) =>
  new Date(Date.parse(`${iso}T00:00:00Z`) + 86_400_000).toISOString().slice(0, 10);

export default function ToolPage() {
  const { id } = useParams<{ id: string }>();
  const tool = useQuery(api.tools.get, { toolId: id });
  const request = useMutation(api.loans.request);
  const [startDate, setStart] = useState("");
  const [endDate, setEnd] = useState("");
  const [note, setNote] = useState("");
  const [sent, setSent] = useState(false);
  const action = useAction();
  const today = new Date().toISOString().slice(0, 10);

  if (tool === undefined) return <Loading />;
  if (tool === null) {
    return (
      <div className="flex flex-col items-center py-16 text-center">
        <Image src="/mascot/pip-tape-measure.png" alt="" width={200} height={139} />
        <p className="mt-4 text-ink-soft">This tool is no longer listed.</p>
        <Link href="/dashboard?tab=browse" className="mt-3 font-medium text-brand underline">
          Browse other tools
        </Link>
      </div>
    );
  }

  // Warn before submitting; the server makes the final call.
  const clash =
    startDate &&
    tool.bookings.some((b) => b.startDate <= (endDate || startDate) && startDate <= b.endDate);

  /** Calendar clicks: first click sets the start, the next one (on or after it) the end. */
  const pick = (day: string) => {
    if (!startDate || (startDate && endDate) || day < startDate) {
      setStart(day);
      setEnd("");
    } else {
      setEnd(day);
    }
  };

  const availableFrom =
    tool.availability.status === "on_loan" && tool.availability.until
      ? nextDay(tool.availability.until)
      : today;

  return (
    <article>
      <Link
        href="/dashboard?tab=browse"
        className="inline-flex items-center gap-1.5 text-sm text-muted hover:text-ink"
      >
        <ArrowLeft className="h-4 w-4" aria-hidden /> All tools
      </Link>

      <div className="mt-4 grid gap-6 lg:grid-cols-[1.4fr_1fr]">
        <div className="space-y-6">
          <div className="overflow-hidden rounded-[1.5rem] bg-white p-2 ring-1 ring-black/5">
            <ToolArt
              tool={tool}
              className="aspect-[16/10] w-full rounded-[1.1rem]"
              iconClass="h-28 w-28"
            />
          </div>

          <section className="rounded-2xl bg-white p-6 ring-1 ring-black/5">
            <h2 className="font-sans text-base font-semibold">About this tool</h2>
            <p className="mt-2 text-ink-soft">{tool.description}</p>
            <dl className="mt-5 grid gap-4 text-sm sm:grid-cols-3">
              <div>
                <dt className="text-xs uppercase tracking-wide text-muted">Category</dt>
                <dd className="mt-1 inline-flex items-center gap-1.5 font-medium">
                  <Tag className="h-3.5 w-3.5" aria-hidden /> {CATEGORY_LABELS[tool.category]}
                </dd>
              </div>
              <div>
                <dt className="text-xs uppercase tracking-wide text-muted">Condition</dt>
                <dd className="mt-1 font-medium capitalize">{tool.condition}</dd>
              </div>
              <div>
                <dt className="text-xs uppercase tracking-wide text-muted">Neighborhood</dt>
                <dd className="mt-1 inline-flex items-center gap-1.5 font-medium">
                  <MapPin className="h-3.5 w-3.5" aria-hidden /> {tool.neighborhood ?? "Not set"}
                </dd>
              </div>
            </dl>
          </section>

          <section className="rounded-2xl bg-white p-6 ring-1 ring-black/5">
            <h2 className="font-sans text-base font-semibold">Availability</h2>
            <p className="mb-5 mt-1 text-sm text-ink-soft">
              {tool.isMine
                ? "Shaded days are booked by approved loans."
                : "Shaded days are already booked. Click a free day to start your dates, then click again to end them."}
            </p>
            <BookingCalendar
              bookings={tool.bookings}
              selectedStart={startDate}
              selectedEnd={endDate}
              onPick={tool.isMine || sent ? undefined : pick}
            />
            {tool.isMine && tool.bookings.length > 0 && (
              <ul className="mt-5 divide-y divide-line rounded-xl ring-1 ring-black/5">
                {tool.bookings.map((b) => (
                  <li key={b.startDate} className="flex justify-between px-4 py-2.5 text-sm">
                    <span>
                      {formatDate(b.startDate)} – {formatDate(b.endDate)}
                    </span>
                    <span className="text-ink-soft">{b.borrowerName}</span>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </div>

        <aside className="space-y-6 lg:sticky lg:top-24 lg:self-start">
          <section className="rounded-2xl bg-white p-6 ring-1 ring-black/5">
            <div className="flex items-start justify-between gap-3">
              <h1 className="text-3xl leading-tight">{tool.name}</h1>
              <AvailabilityBadge availability={tool.availability} />
            </div>
            <p className="mt-3 inline-flex items-center gap-1.5 text-sm text-ink-soft">
              <CalendarCheck className="h-4 w-4 text-ok" aria-hidden />
              {availableFrom === today
                ? "Available now"
                : `Available from ${formatDate(availableFrom)}`}
            </p>
            <div className="mt-1">
              <BookingNote availability={tool.availability} />
            </div>

            <div className="mt-5 flex items-center gap-3 rounded-xl bg-paper p-3">
              <span className="flex h-10 w-10 items-center justify-center rounded-full bg-brand text-sm font-semibold text-white">
                {tool.ownerName.slice(0, 1)}
              </span>
              <div className="min-w-0 flex-1 text-sm">
                <p className="font-medium">
                  {tool.isMine ? "Your tool" : tool.ownerName}
                  {tool.ownerTrusted && (
                    <BadgeCheck
                      className="ml-1 inline h-4 w-4 text-brand"
                      aria-label="Trusted Lender"
                    />
                  )}
                </p>
                {tool.ownerRating ? (
                  <Stars value={tool.ownerRating.average} count={tool.ownerRating.count} />
                ) : (
                  <span className="text-xs text-muted">No ratings yet</span>
                )}
              </div>
            </div>
          </section>

          {!tool.isMine && (
            <section className="rounded-2xl bg-white p-6 ring-1 ring-black/5">
              {sent ? (
                <div className="text-center">
                  <Image
                    src="/mascot/pip-waving.png"
                    alt=""
                    width={90}
                    height={98}
                    className="mx-auto"
                  />
                  <p className="mt-2 font-medium text-ok">Request sent!</p>
                  <Link
                    href="/dashboard?tab=requests"
                    className="mt-1 inline-block text-sm text-brand underline"
                  >
                    Track it in My requests
                  </Link>
                </div>
              ) : tool.hasPendingRequest ? (
                <p className="text-sm text-ink-soft">
                  You already have a pending request for this tool.
                </p>
              ) : (
                <form
                  className="space-y-3"
                  onSubmit={async (e) => {
                    e.preventDefault();
                    const ok = await action.run(() =>
                      request({ toolId: tool._id, startDate, endDate, note }),
                    );
                    if (ok) setSent(true);
                  }}
                >
                  <h2 className="font-sans text-base font-semibold">Request to borrow</h2>
                  <p className="text-xs text-muted">
                    Pick dates here or on the calendar. {tool.ownerName} shares exactly where to
                    pick it up once they approve.
                  </p>
                  <div className="flex gap-2">
                    <label className="flex-1 text-xs text-muted">
                      From
                      <input
                        type="date"
                        required
                        min={today}
                        value={startDate}
                        onChange={(e) => setStart(e.target.value)}
                        className={inputClass}
                      />
                    </label>
                    <label className="flex-1 text-xs text-muted">
                      To
                      <input
                        type="date"
                        required
                        min={startDate || today}
                        value={endDate}
                        onChange={(e) => setEnd(e.target.value)}
                        className={inputClass}
                      />
                    </label>
                  </div>
                  <label className="block text-xs text-muted">
                    Note to {tool.ownerName} (optional)
                    <textarea
                      rows={2}
                      maxLength={280}
                      placeholder="What's it for? When can you pick it up?"
                      value={note}
                      onChange={(e) => setNote(e.target.value)}
                      className={inputClass}
                    />
                  </label>
                  {clash && (
                    <p className="text-sm text-warn">Those dates overlap an existing booking.</p>
                  )}
                  <Button type="submit" className="w-full" disabled={action.pending || !!clash}>
                    Send request
                  </Button>
                  <ErrorText error={action.error} />
                </form>
              )}
            </section>
          )}

          <p className="flex items-start gap-2 px-1 text-xs text-muted">
            <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
            Pickup details are shared only with the approved borrower and deleted after the loan.
          </p>
        </aside>
      </div>
    </article>
  );
}
