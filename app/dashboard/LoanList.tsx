"use client";

import { useMutation } from "convex/react";
import type { FunctionReturnType } from "convex/server";
import { api } from "@/convex/_generated/api";
import Image from "next/image";
import Link from "next/link";
import { useState } from "react";
import {
  ActionLink,
  LoanStatusBadge,
  Loading,
  Button,
  Empty,
  ErrorText,
  StarPicker,
  formatDate,
  inputClass,
  daysSince,
  timeAgo,
  useAction,
} from "./ui";
import { EntityTable } from "./EntityTable";
import {
  FilterPills,
  Pager,
  SearchField,
  ViewToggle,
  useDebounced,
  usePagedQuery,
  useViewMode,
} from "./collection";

export type Loan = FunctionReturnType<typeof api.loans.page>["page"][number];

/** "My requests" (borrower) and "Incoming requests" (owner) share one list. */
const STATUS_FILTERS = [
  { value: "" as const, label: "All" },
  { value: "pending" as const, label: "Pending" },
  { value: "approved" as const, label: "Active" },
  { value: "overdue" as const, label: "Overdue" },
  { value: "returned" as const, label: "Returned" },
  { value: "declined" as const, label: "Declined" },
  { value: "cancelled" as const, label: "Cancelled" },
];
type StatusFilter = (typeof STATUS_FILTERS)[number]["value"];

/**
 * Paginated loans for one side ("borrower", "owner") or all of them (admin), with a status
 * filter and a cards/table toggle. The table is an expandable "entity table": clicking a
 * row opens the full loan card (actions, pickup, history) inline beneath it.
 */
export function LoanList({ view }: { view: "borrower" | "owner" | "admin" }) {
  const [status, setStatus] = useState<StatusFilter>("");
  const [sort, setSort] = useState<"newest" | "oldest">("newest");
  const [mode, setMode] = useViewMode(`loans-${view}`, view === "admin" ? "table" : "cards");
  const role = view === "admin" ? "all" : view;

  const [term, setTerm] = useState("");
  const search = useDebounced(term);
  const [pageSize, setPageSize] = useState(10);
  const pager = usePagedQuery(
    api.loans.page,
    { role, status: status || undefined, sort, search },
    pageSize,
  );
  const results = pager.rows;

  return (
    <section>
      <div className="mb-5 flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
        <FilterPills
          label="Filter by status"
          options={STATUS_FILTERS}
          value={status}
          onChange={setStatus}
        />
        <div className="flex flex-wrap items-center gap-2 xl:justify-end">
          <SearchField
            value={term}
            onChange={setTerm}
            placeholder={
              view === "admin"
                ? "Search tool, borrower, owner…"
                : view === "owner"
                  ? "Search tool or borrower…"
                  : "Search tool or owner…"
            }
          />
          <select
            aria-label="Sort"
            value={sort}
            onChange={(e) => setSort(e.target.value as typeof sort)}
            className={`${inputClass} mt-0 w-auto py-1.5`}
          >
            <option value="newest">Newest</option>
            <option value="oldest">Oldest</option>
          </select>
          <ViewToggle mode={mode} onChange={setMode} />
        </div>
      </div>

      {pager.loading ? (
        <Loading />
      ) : results.length === 0 ? (
        status || search ? (
          <Empty
            pip={false}
            action={
              <Button
                variant="ghost"
                onClick={() => {
                  setStatus("");
                  setTerm("");
                }}
              >
                Clear search and filters
              </Button>
            }
          >
            No loans match that search or status.
          </Empty>
        ) : (
          <Empty
            pip={view !== "admin"}
            action={
              view === "borrower" ? (
                <ActionLink href="/dashboard?tab=browse">Browse tools</ActionLink>
              ) : view === "owner" ? (
                <ActionLink href="/dashboard?tab=listings">Add a tool or a photo</ActionLink>
              ) : undefined
            }
          >
            {view === "borrower"
              ? "You haven't asked to borrow anything yet. See what your neighbors are lending."
              : view === "owner"
                ? "No one has asked to borrow your tools yet. Listings with a photo and a clear description get noticed first."
                : "No loans yet."}
          </Empty>
        )
      ) : mode === "cards" ? (
        <ul className="grid gap-4 lg:grid-cols-2">
          {results.map((loan) => (
            <LoanRow key={loan._id} loan={loan} view={view} />
          ))}
        </ul>
      ) : (
        <EntityTable
          rows={results}
          rowKey={(l) => l._id}
          rowLabel={(l) => l.toolName}
          caption="Loans"
          minWidth={760}
          columns={[
            {
              key: "tool",
              header: "Tool",
              className: "font-medium",
              cell: (loan) => (
                <Link href={`/dashboard/tools/${loan.toolId}`} className="hover:text-brand">
                  {loan.toolName}
                </Link>
              ),
            },
            {
              key: "who",
              header:
                view === "borrower" ? "Owner" : view === "owner" ? "Borrower" : "Borrower → owner",
              className: "text-ink-soft",
              cell: (loan) =>
                view === "borrower"
                  ? loan.ownerName
                  : view === "owner"
                    ? loan.borrowerName
                    : `${loan.borrowerName} → ${loan.ownerName}`,
            },
            {
              key: "dates",
              header: "Dates",
              className: "whitespace-nowrap text-ink-soft",
              cell: (loan) => `${formatDate(loan.startDate)} – ${formatDate(loan.endDate)}`,
            },
            {
              key: "status",
              header: "Status",
              cell: (loan) => <LoanStatusBadge status={loan.status} overdue={loan.overdue} />,
            },
            {
              key: "automation",
              header: "Last automation",
              className: "text-xs text-muted",
              cell: (loan) =>
                loan.lastAutomation
                  ? `${loan.lastAutomation.kind === "overdue_reminder" ? "Reminder" : "Notification"} ${loan.lastAutomation.status} · ${timeAgo(loan.lastAutomation.at)}`
                  : "—",
            },
          ]}
          renderExpanded={(loan) => (
            // The full loan card: actions, pickup, overdue banner, rating and history.
            <ul>
              <LoanRow loan={loan} view={view} />
            </ul>
          )}
        />
      )}

      <Pager
        page={pager.page}
        from={pager.from}
        count={results.length}
        hasPrev={pager.hasPrev}
        hasNext={pager.hasNext}
        onPrev={pager.prev}
        onNext={pager.next}
        pageSize={pageSize}
        onPageSize={setPageSize}
      />
    </section>
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

  // Stamp the card when its status changes while you're looking at it (not on first load).
  // Adjusting state during render on a prop change is React's recommended pattern here.
  const [seenStatus, setSeenStatus] = useState(loan.status);
  const [stamp, setStamp] = useState<keyof typeof STAMPS | null>(null);
  if (seenStatus !== loan.status) {
    setSeenStatus(loan.status);
    if (loan.status in STAMPS) setStamp(loan.status as keyof typeof STAMPS);
  }

  const who =
    view === "borrower"
      ? `from ${loan.ownerName}`
      : view === "owner"
        ? `requested by ${loan.borrowerName}`
        : `${loan.borrowerName} borrowing from ${loan.ownerName}`;

  return (
    <li className="relative overflow-hidden rounded-card border border-line bg-surface p-4 shadow-card">
      {stamp && (
        <span
          key={stamp}
          className={`stamp rounded-md border-4 px-4 py-1 font-display text-3xl tracking-widest ${STAMPS[stamp].className}`}
          aria-hidden
          onAnimationEnd={() => setStamp(null)}
        >
          {STAMPS[stamp].label}
        </span>
      )}
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <Link href={`/dashboard/tools/${loan.toolId}`} className="font-medium hover:underline">
            {loan.toolName}
          </Link>{" "}
          <span className="text-sm text-muted">{who}</span>
          <p className="text-xs text-muted">
            {formatDate(loan.startDate)} → {formatDate(loan.endDate)}
          </p>
        </div>
        <div className="flex items-center gap-1">
          <LoanStatusBadge status={loan.status} overdue={loan.overdue} />
        </div>
      </div>

      {loan.overdue && (
        <div
          role="status"
          className="mt-3 flex items-center gap-3 rounded-xl border border-danger/20 bg-danger-soft px-3 py-2 text-sm text-danger"
        >
          <Image src="/mascot/pip-alarm.png" alt="" width={40} height={31} />
          <span>
            <strong>
              Overdue by {daysSince(loan.endDate)} day{daysSince(loan.endDate) === 1 ? "" : "s"}
            </strong>{" "}
            · was due {formatDate(loan.endDate)}.{" "}
            {view === "owner"
              ? "A daily reminder goes to the borrower until you mark it returned."
              : view === "borrower"
                ? "Please return it or message the owner."
                : "Daily reminders are being sent."}
          </span>
        </div>
      )}

      {loan.note && (
        <p className="mt-2 rounded-lg bg-paper px-3 py-2 text-sm text-ink">“{loan.note}”</p>
      )}

      {loan.pickup && !editingPickup && (
        <div className="mt-2 rounded-lg border border-ok/20 bg-ok-soft px-3 py-2 text-sm">
          <p className="text-xs font-medium text-ok">
            {loan.pickup.kind === "home" ? "🏠 Pickup at home" : "☕ Meet-up spot"}
            {view === "owner" && " · visible only to the borrower while the loan is active"}
          </p>
          <p className="text-ink">{loan.pickup.details}</p>
          {view === "owner" && loan.status === "approved" && (
            <button
              type="button"
              onClick={() => setEditingPickup(true)}
              className="mt-1 text-xs text-ok underline"
            >
              Change
            </button>
          )}
        </div>
      )}
      {view === "borrower" && loan.status === "pending" && (
        <p className="mt-2 text-xs text-muted">
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
        <p className="mt-2 text-xs text-muted">
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
        <p className="mt-2 text-xs text-muted">You rated this loan {loan.myRating}★</p>
      )}

      <details className="mt-3 text-xs text-muted">
        <summary className="cursor-pointer select-none">History</summary>
        <ol className="mt-2 space-y-1 border-l border-line pl-3">
          {loan.timeline.map((e, i) => (
            <li key={i}>
              <span className="text-muted">{timeAgo(e.at)}</span> · {describe(e)}
            </li>
          ))}
        </ol>
      </details>
    </li>
  );
}

/** Library checkout stamps: indigo ink for progress, red ink for a refusal. */
const STAMPS = {
  approved: { label: "APPROVED", className: "border-brand text-brand bg-surface/80" },
  returned: { label: "RETURNED", className: "border-brand text-brand bg-surface/80" },
  declined: { label: "DECLINED", className: "border-accent text-accent bg-surface/80" },
} as const;

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
      className="mt-3 space-y-2 rounded-lg border border-line p-3"
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
      <p className="text-xs text-muted">
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
      className="mt-3 space-y-2 rounded-lg bg-accent-soft p-3"
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
