"use client";

import { useMutation, useQuery } from "convex/react";
import { BadgeCheck, ScrollText, Users } from "lucide-react";
import { useState } from "react";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import { LoanRow } from "./LoanList";
import { Button, Empty, Loading, Stars, TextPromptDialog, timeAgo } from "./ui";

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
  const [changing, setChanging] = useState<{
    id: Id<"users">;
    name: string;
    trusted: boolean;
  } | null>(null);

  return (
    <div className="space-y-10">
      <section>
        <h2 className="mb-3 flex items-center gap-2 text-xl font-bold">
          <Users className="h-5 w-5 text-brand" aria-hidden /> Neighbors
        </h2>
        {users === undefined ? (
          <Loading />
        ) : (
          <ul className="divide-y divide-line rounded-card border border-line bg-surface shadow-card">
            {users.map((u) => (
              <li
                key={u._id}
                className="flex flex-wrap items-center justify-between gap-2 px-4 py-3"
              >
                <div>
                  <span className="font-medium">{u.name}</span>{" "}
                  <span className="text-sm text-muted">{u.email}</span>
                  {u.role === "admin" && <span className="ml-2 text-xs text-muted">admin</span>}
                  {u.trustedLender && <span className="ml-2 text-xs text-ok">★ Trusted</span>}
                  {u.rating && (
                    <div>
                      <Stars value={u.rating.average} count={u.rating.count} />
                    </div>
                  )}
                </div>
                <Button
                  size="sm"
                  variant={u.trustedLender ? "ghost" : "primary"}
                  onClick={() =>
                    setChanging({ id: u._id, name: u.name, trusted: !u.trustedLender })
                  }
                >
                  <BadgeCheck className="h-4 w-4" aria-hidden />
                  {u.trustedLender ? "Remove Trusted Lender" : "Mark Trusted Lender"}
                </Button>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section>
        <h2 className="mb-1 flex items-center gap-2 text-xl font-bold">
          <ScrollText className="h-5 w-5 text-brand" aria-hidden /> Audit log
        </h2>
        <p className="mb-3 text-sm text-muted">
          Every admin action, with who, when and why. Append-only.
        </p>
        {log === undefined ? (
          <Loading />
        ) : log.length === 0 ? (
          <Empty>No admin actions yet.</Empty>
        ) : (
          <ul className="divide-y divide-line rounded-card border border-line bg-surface shadow-card text-sm">
            {log.map((e) => (
              <li key={e._id} className="px-4 py-2">
                <span className="font-medium">{e.actorName}</span> {AUDIT_TEXT[e.action]}{" "}
                {e.targetLabel}
                {e.reason && <span className="text-muted"> · “{e.reason}”</span>}
                <span className="float-right text-xs text-muted">{timeAgo(e.at)}</span>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section>
        <h2 className="mb-3 text-xl font-bold">All loans</h2>
        {loans === undefined ? (
          <Loading />
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
      <TextPromptDialog
        open={changing !== null}
        title={
          changing?.trusted
            ? `Mark ${changing.name} as a Trusted Lender?`
            : `Remove Trusted Lender from ${changing?.name ?? ""}?`
        }
        description="Optional reason, saved in the audit log."
        placeholder="e.g. 5 smooth loans, great ratings"
        confirmLabel="Confirm"
        onConfirm={(reason) =>
          setTrusted({ userId: changing!.id, trusted: changing!.trusted, reason })
        }
        onClose={() => setChanging(null)}
      />
    </div>
  );
}
