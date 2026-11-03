"use client";

import { useMutation, useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { LoanRow } from "./LoanList";
import { Button, Empty, ErrorText, Stars, timeAgo, useAction } from "./ui";

const AUDIT_TEXT = {
  listing_removed: "removed listing",
  trusted_granted: "marked Trusted Lender:",
  trusted_revoked: "removed Trusted Lender from",
} as const;

export function AdminPanel() {
  const users = useQuery(api.users.listForAdmin);
  const loans = useQuery(api.loans.all);
  const log = useQuery(api.users.auditLog);
  const setTrusted = useMutation(api.users.setTrustedLender);
  const action = useAction();

  return (
    <div className="space-y-10">
      <section>
        <h2 className="mb-3 font-medium">Neighbors</h2>
        <ErrorText error={action.error} />
        {users === undefined ? (
          <p className="text-stone-500">Loading…</p>
        ) : (
          <ul className="divide-y divide-stone-200 rounded-xl border border-stone-200 bg-white">
            {users.map((u) => (
              <li
                key={u._id}
                className="flex flex-wrap items-center justify-between gap-2 px-4 py-3"
              >
                <div>
                  <span className="font-medium">{u.name}</span>{" "}
                  <span className="text-sm text-stone-500">{u.email}</span>
                  {u.role === "admin" && <span className="ml-2 text-xs text-stone-500">admin</span>}
                  {u.trustedLender && (
                    <span className="ml-2 text-xs text-emerald-700">★ Trusted</span>
                  )}
                  {u.rating && (
                    <div>
                      <Stars value={u.rating.average} count={u.rating.count} />
                    </div>
                  )}
                </div>
                <Button
                  variant={u.trustedLender ? "ghost" : "primary"}
                  disabled={action.pending}
                  onClick={() => {
                    // Temporary prompt until the redesign adds a proper dialog.
                    const reason = prompt("Reason (optional, saved in the audit log)");
                    if (reason === null) return;
                    action.run(() =>
                      setTrusted({ userId: u._id, trusted: !u.trustedLender, reason }),
                    );
                  }}
                >
                  {u.trustedLender ? "Remove Trusted Lender" : "Mark Trusted Lender"}
                </Button>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section>
        <h2 className="mb-3 font-medium">Audit log</h2>
        {log === undefined ? (
          <p className="text-stone-500">Loading…</p>
        ) : log.length === 0 ? (
          <Empty>No admin actions yet.</Empty>
        ) : (
          <ul className="divide-y divide-stone-200 rounded-xl border border-stone-200 bg-white text-sm">
            {log.map((e) => (
              <li key={e._id} className="px-4 py-2">
                <span className="font-medium">{e.actorName}</span> {AUDIT_TEXT[e.action]}{" "}
                {e.targetLabel}
                {e.reason && <span className="text-stone-500"> · “{e.reason}”</span>}
                <span className="float-right text-xs text-stone-400">{timeAgo(e.at)}</span>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section>
        <h2 className="mb-3 font-medium">All loans</h2>
        {loans === undefined ? (
          <p className="text-stone-500">Loading…</p>
        ) : loans.length === 0 ? (
          <Empty>No loans yet.</Empty>
        ) : (
          <ul className="space-y-2">
            {loans.map((loan) => (
              <LoanRow key={loan._id} loan={loan} view="admin" />
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
