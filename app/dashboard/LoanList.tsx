"use client";

import { useMutation, useQuery } from "convex/react";
import type { FunctionReturnType } from "convex/server";
import { api } from "@/convex/_generated/api";
import Link from "next/link";
import { useState } from "react";
import {
  Badge,
  Button,
  Empty,
  ErrorText,
  StarPicker,
  formatDate,
  inputClass,
  timeAgo,
  useAction,
} from "./ui";

export type Loan = FunctionReturnType<typeof api.loans.all>[number];

/** "My requests" (borrower) and "Incoming requests" (owner) share one list. */
export function LoanList({ view }: { view: "borrower" | "owner" }) {
  const loans = useQuery(view === "borrower" ? api.loans.myRequests : api.loans.incoming);

  if (loans === undefined) return <p className="text-stone-500">Loading…</p>;
  if (loans.length === 0) {
    return (
      <Empty>
        {view === "borrower"
          ? "You haven't asked to borrow anything yet."
          : "No one has asked to borrow your tools yet."}
      </Empty>
    );
  }
  return (
    <ul className="space-y-2">
      {loans.map((loan) => (
        <LoanRow key={loan._id} loan={loan} view={view} />
      ))}
    </ul>
  );
}

export function LoanRow({ loan, view }: { loan: Loan; view: "borrower" | "owner" | "admin" }) {
  const decide = useMutation(api.loans.decide);
  const cancel = useMutation(api.loans.cancel);
  const markReturned = useMutation(api.loans.markReturned);
  const updatePickup = useMutation(api.loans.updatePickup);
  const [approving, setApproving] = useState(false);
  const [editingPickup, setEditingPickup] = useState(false);
  const action = useAction();

  const who =
    view === "borrower"
      ? `from ${loan.ownerName}`
      : view === "owner"
        ? `requested by ${loan.borrowerName}`
        : `${loan.borrowerName} borrowing from ${loan.ownerName}`;

  return (
    <li className="rounded-xl border border-stone-200 bg-white p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <Link href={`/dashboard/tools/${loan.toolId}`} className="font-medium hover:underline">
            {loan.toolName}
          </Link>{" "}
          <span className="text-sm text-stone-500">{who}</span>
          <p className="text-xs text-stone-500">
            {formatDate(loan.startDate)} → {formatDate(loan.endDate)}
          </p>
        </div>
        <div className="flex gap-1">
          <Badge tone={loan.status}>{loan.status}</Badge>
          {loan.overdue && <Badge tone="overdue">overdue</Badge>}
        </div>
      </div>

      {loan.note && (
        <p className="mt-2 rounded-lg bg-stone-50 px-3 py-2 text-sm text-stone-700">
          “{loan.note}”
        </p>
      )}

      {loan.pickup && !editingPickup && (
        <div className="mt-2 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm">
          <p className="text-xs font-medium text-emerald-800">
            {loan.pickup.kind === "home" ? "🏠 Pickup at home" : "☕ Meet-up spot"}
            {view === "owner" && " · visible only to the borrower while the loan is active"}
          </p>
          <p className="text-stone-700">{loan.pickup.details}</p>
          {view === "owner" && loan.status === "approved" && (
            <button
              type="button"
              onClick={() => setEditingPickup(true)}
              className="mt-1 text-xs text-emerald-800 underline"
            >
              Change
            </button>
          )}
        </div>
      )}
      {view === "borrower" && loan.status === "pending" && (
        <p className="mt-2 text-xs text-stone-500">
          Pickup details will appear here once {loan.ownerName} approves.
        </p>
      )}
      {approving && (
        <PickupForm
          submitLabel="Approve and share"
          onCancel={() => setApproving(false)}
          onSubmit={(pickup) => decide({ loanId: loan._id, approve: true, pickup })}
        />
      )}
      {editingPickup && loan.pickup && (
        <PickupForm
          initial={loan.pickup}
          submitLabel="Save pickup details"
          onCancel={() => setEditingPickup(false)}
          onSubmit={async (pickup) => {
            await updatePickup({ loanId: loan._id, pickup });
            setEditingPickup(false);
          }}
        />
      )}

      {loan.lastAutomation && (
        <p className="mt-2 text-xs text-stone-500">
          {loan.lastAutomation.kind === "overdue_reminder" ? "Reminder" : "Notification"}{" "}
          {loan.lastAutomation.status === "sent" ? "sent" : "failed"}{" "}
          {timeAgo(loan.lastAutomation.at)}
        </p>
      )}

      <div className="mt-3 flex gap-2">
        {view === "owner" && loan.status === "pending" && (
          <>
            <Button disabled={action.pending} onClick={() => setApproving(true)}>
              Approve…
            </Button>
            <Button
              variant="ghost"
              disabled={action.pending}
              onClick={() => action.run(() => decide({ loanId: loan._id, approve: false }))}
            >
              Decline
            </Button>
          </>
        )}
        {view === "owner" && loan.status === "approved" && (
          <Button
            disabled={action.pending}
            onClick={() => action.run(() => markReturned({ loanId: loan._id }))}
          >
            Mark returned
          </Button>
        )}
        {view === "borrower" && loan.status === "pending" && (
          <Button
            variant="ghost"
            disabled={action.pending}
            onClick={() => action.run(() => cancel({ loanId: loan._id }))}
          >
            Cancel request
          </Button>
        )}
      </div>
      <ErrorText error={action.error} />

      {loan.canRate && <RateForm loan={loan} asOwner={view === "owner"} />}
      {loan.myRating && (
        <p className="mt-2 text-xs text-stone-500">You rated this loan {loan.myRating}★</p>
      )}

      <details className="mt-3 text-xs text-stone-500">
        <summary className="cursor-pointer select-none">History</summary>
        <ol className="mt-2 space-y-1 border-l border-stone-200 pl-3">
          {loan.timeline.map((e, i) => (
            <li key={i}>
              <span className="text-stone-400">{timeAgo(e.at)}</span> · {describe(e)}
            </li>
          ))}
        </ol>
      </details>
    </li>
  );
}

type Pickup = { kind: "home" | "meetup"; details: string };

/** Owner writes how to collect the tool. Shared only with this borrower, only while active. */
function PickupForm({
  initial,
  submitLabel,
  onSubmit,
  onCancel,
}: {
  initial?: Pickup;
  submitLabel: string;
  onSubmit: (pickup: Pickup) => Promise<unknown>;
  onCancel: () => void;
}) {
  const [kind, setKind] = useState<Pickup["kind"]>(initial?.kind ?? "meetup");
  const [details, setDetails] = useState(initial?.details ?? "");
  const action = useAction();

  return (
    <form
      className="mt-3 space-y-2 rounded-lg border border-stone-200 p-3"
      onSubmit={(e) => {
        e.preventDefault();
        action.run(() => onSubmit({ kind, details }));
      }}
    >
      <p className="text-sm font-medium">Where should they pick it up?</p>
      <div className="flex gap-4 text-sm">
        <label className="flex items-center gap-1">
          <input type="radio" checked={kind === "meetup"} onChange={() => setKind("meetup")} />
          Public meet-up spot (safer)
        </label>
        <label className="flex items-center gap-1">
          <input type="radio" checked={kind === "home"} onChange={() => setKind("home")} />
          My home
        </label>
      </div>
      <textarea
        required
        rows={2}
        maxLength={300}
        placeholder={
          kind === "meetup"
            ? "e.g. Kaldi's Coffee, Bole, Saturday 10am"
            : "e.g. Near Edna Mall, blue gate. Call when you arrive."
        }
        value={details}
        onChange={(e) => setDetails(e.target.value)}
        className={inputClass}
      />
      <p className="text-xs text-stone-500">
        Only this borrower sees this, only while the loan is active. It&apos;s deleted when the tool
        comes back.
      </p>
      <div className="flex gap-2">
        <Button type="submit" disabled={action.pending}>
          {submitLabel}
        </Button>
        <Button type="button" variant="ghost" onClick={onCancel}>
          Cancel
        </Button>
      </div>
      <ErrorText error={action.error} />
    </form>
  );
}

const ACTION_TEXT: Record<string, string> = {
  requested: "requested it",
  approved: "approved",
  declined: "declined",
  cancelled: "cancelled the request",
  returned: "marked it returned",
  listing_removed: "removed the listing",
};

function describe(e: Loan["timeline"][number]) {
  if (e.kind === "action") return `${e.actorName} ${ACTION_TEXT[e.type] ?? e.type}`;
  const what = e.type === "overdue_reminder" ? "Overdue reminder" : "Notification";
  return `${what} ${e.status === "sent" ? "sent" : "failed"} (n8n)`;
}

function RateForm({ loan, asOwner }: { loan: Loan; asOwner: boolean }) {
  const rate = useMutation(api.ratings.rate);
  const [stars, setStars] = useState(0);
  const [comment, setComment] = useState("");
  const action = useAction();

  return (
    <form
      className="mt-3 space-y-2 rounded-lg bg-amber-50 p-3"
      onSubmit={(e) => {
        e.preventDefault();
        action.run(() => rate({ loanId: loan._id, stars, comment }));
      }}
    >
      <p className="text-sm font-medium">
        {asOwner
          ? `How was ${loan.borrowerName} as a borrower?`
          : `How was borrowing from ${loan.ownerName}?`}
      </p>
      <StarPicker value={stars} onChange={setStars} />
      <input
        maxLength={280}
        placeholder="Optional comment"
        value={comment}
        onChange={(e) => setComment(e.target.value)}
        className={inputClass}
      />
      <Button type="submit" disabled={!stars || action.pending}>
        Submit rating
      </Button>
      <ErrorText error={action.error} />
    </form>
  );
}
