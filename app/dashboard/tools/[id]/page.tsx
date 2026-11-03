"use client";

import { useMutation, useQuery } from "convex/react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useState } from "react";
import { api } from "@/convex/_generated/api";
import { CATEGORY_LABELS } from "@/convex/lib/constants";
import { Badge, Button, ErrorText, Stars, formatDate, inputClass, useAction } from "../../ui";
import { BookingCalendar } from "./BookingCalendar";

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

  if (tool === undefined) return <p className="text-stone-500">Loading…</p>;
  if (tool === null) {
    return (
      <p className="text-stone-500">
        This tool is no longer listed.{" "}
        <Link href="/dashboard" className="underline">
          Back to tools
        </Link>
      </p>
    );
  }

  // Warn before submitting; the server makes the final call.
  const clash =
    startDate &&
    tool.bookings.some((b) => b.startDate <= (endDate || startDate) && startDate <= b.endDate);

  return (
    <article>
      <Link href="/dashboard" className="text-sm text-stone-500 hover:text-stone-800">
        ← All tools
      </Link>

      <div className="mt-4 grid gap-8 md:grid-cols-2">
        <div>
          {tool.photoUrl ? (
            // eslint-disable-next-line @next/next/no-img-element -- Convex storage URLs are signed per request
            <img
              src={tool.photoUrl}
              alt={tool.name}
              className="aspect-[4/3] w-full rounded-xl object-cover"
            />
          ) : (
            <div className="flex aspect-[4/3] items-center justify-center rounded-xl bg-stone-100 text-stone-400">
              No photo
            </div>
          )}
        </div>

        <div>
          <div className="flex items-start justify-between gap-2">
            <h1 className="text-2xl font-semibold">{tool.name}</h1>
            <Badge tone={tool.availability.status}>
              {tool.availability.status === "available"
                ? "Available"
                : `Back ${formatDate(tool.availability.until!)}`}
            </Badge>
          </div>
          <p className="mt-1 text-sm text-stone-500">
            {tool.neighborhood && <>📍 {tool.neighborhood} · </>}
            {CATEGORY_LABELS[tool.category]} · {tool.condition} condition
          </p>
          <p className="mt-4 text-stone-700">{tool.description}</p>

          <div className="mt-4 rounded-lg bg-stone-50 p-3 text-sm">
            {tool.isMine ? (
              "This is your tool."
            ) : (
              <>
                Lent by <span className="font-medium">{tool.ownerName}</span>
                {tool.ownerTrusted && <span className="text-emerald-700"> ★ Trusted Lender</span>}
                {tool.ownerRating && (
                  <div>
                    <Stars value={tool.ownerRating.average} count={tool.ownerRating.count} />
                  </div>
                )}
              </>
            )}
          </div>

          {!tool.isMine && (
            <div className="mt-6">
              {sent ? (
                <p className="text-emerald-700">
                  Request sent! Track it under{" "}
                  <Link href="/dashboard?tab=requests" className="underline">
                    My requests
                  </Link>
                  .
                </p>
              ) : tool.hasPendingRequest ? (
                <p className="text-stone-500">You already have a pending request for this tool.</p>
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
                  <h2 className="font-medium">Request to borrow</h2>
                  <p className="text-xs text-stone-500">
                    {tool.ownerName} shares exactly where to pick it up once they approve.
                  </p>
                  <div className="flex gap-2">
                    <label className="flex-1 text-xs text-stone-600">
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
                    <label className="flex-1 text-xs text-stone-600">
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
                  <label className="block text-xs text-stone-600">
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
                    <p className="text-sm text-amber-700">
                      Those dates overlap an existing booking.
                    </p>
                  )}
                  <Button type="submit" disabled={action.pending || !!clash}>
                    Send request
                  </Button>
                  <ErrorText error={action.error} />
                </form>
              )}
            </div>
          )}
        </div>
      </div>

      <section className="mt-10 rounded-xl border border-stone-200 bg-white p-4">
        <h2 className="mb-4 font-medium">Availability</h2>
        <BookingCalendar bookings={tool.bookings} selectedStart={startDate} selectedEnd={endDate} />
        {tool.isMine && tool.bookings.length > 0 && (
          <ul className="mt-4 space-y-1 text-sm text-stone-600">
            {tool.bookings.map((b) => (
              <li key={b.startDate}>
                {formatDate(b.startDate)} – {formatDate(b.endDate)}: {b.borrowerName}
              </li>
            ))}
          </ul>
        )}
      </section>
    </article>
  );
}
