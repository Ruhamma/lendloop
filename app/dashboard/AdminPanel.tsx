"use client";

import { useMutation, useQuery } from "convex/react";
import { BadgeCheck, Repeat, ScrollText, Users } from "lucide-react";
import { useState } from "react";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import { FilterPills, Pager, SearchField, useDebounced, usePagedQuery } from "./collection";
import { EntityTable } from "./EntityTable";
import { LoanList } from "./LoanList";
import { Button, Empty, Loading, Stars, TextPromptDialog, timeAgo } from "./ui";

const SECTIONS = [
  { id: "neighbors", label: "Neighbors", icon: Users },
  { id: "audit", label: "Audit log", icon: ScrollText },
  { id: "loans", label: "All loans", icon: Repeat },
] as const;

const KIND_STYLES = {
  admin: "bg-brand-soft text-brand",
  loan: "bg-sky/40 text-ink",
  automation: "bg-sun-soft text-ink",
} as const;

/** Admin: jump-to bar, then neighbors, the general audit log and every loan. */
export function AdminPanel() {
  return (
    <div className="space-y-10">
      {/* Title on the left, section jumps on the right. The row stays pinned under the top
          bar so you can jump between long sections from anywhere on the page. */}
      <div className="sticky top-[3.6rem] z-20 -mx-4 flex flex-col gap-3 bg-paper/95 px-4 py-3 backdrop-blur sm:-mx-6 sm:px-6 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <h1 className="text-3xl">Admin</h1>
          <p className="mt-1 text-ink-soft">Neighbors, every loan, and the audit log.</p>
        </div>
        <nav aria-label="Admin sections" className="flex gap-2 overflow-x-auto">
          {SECTIONS.map((s) => (
            <a
              key={s.id}
              href={`#${s.id}`}
              className="inline-flex items-center gap-2 whitespace-nowrap rounded-xl bg-white px-3 py-2 text-sm font-medium ring-1 ring-black/5 hover:text-brand"
            >
              <s.icon className="h-4 w-4" aria-hidden /> {s.label}
            </a>
          ))}
        </nav>
      </div>

      <section id="neighbors" className="scroll-mt-40">
        <Neighbors />
      </section>

      <section id="audit" className="scroll-mt-40">
        <SectionTitle
          icon={ScrollText}
          title="Audit log"
          subtitle="Every admin action, loan change and automation, newest first. Append-only."
        />
        <ActivityLog />
      </section>

      <section id="loans" className="scroll-mt-40">
        <SectionTitle
          icon={Repeat}
          title="All loans"
          subtitle="Search by tool, borrower or owner, or filter by status."
        />
        <LoanList view="admin" />
      </section>
    </div>
  );
}

/** Section heading with an optional control (e.g. a search box) on the right. */
function SectionTitle({
  icon: Icon,
  title,
  subtitle,
  right,
}: {
  icon: typeof Users;
  title: string;
  subtitle?: string;
  right?: React.ReactNode;
}) {
  return (
    <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
      <div>
        <h2 className="flex items-center gap-2 text-xl font-bold">
          <Icon className="h-5 w-5 text-brand" aria-hidden /> {title}
        </h2>
        {subtitle && <p className="mt-1 text-sm text-muted">{subtitle}</p>}
      </div>
      {right}
    </div>
  );
}

function Neighbors() {
  const [term, setTerm] = useState("");
  const search = useDebounced(term);
  const [pageSize, setPageSize] = useState(10);
  const pager = usePagedQuery(api.users.page, { search }, pageSize);
  const setTrusted = useMutation(api.users.setTrustedLender);
  const [changing, setChanging] = useState<{
    id: Id<"users">;
    name: string;
    trusted: boolean;
  } | null>(null);

  return (
    <div>
      <SectionTitle
        icon={Users}
        title="Neighbors"
        subtitle="Everyone who has signed in, with their role and rating."
        right={<SearchField value={term} onChange={setTerm} placeholder="Search by name…" />}
      />
      {pager.loading ? (
        <Loading />
      ) : pager.rows.length === 0 ? (
        <Empty pip={false}>No neighbors match that search.</Empty>
      ) : (
        <EntityTable
          rows={pager.rows}
          rowKey={(u) => u._id}
          caption="Neighbors"
          minWidth={640}
          columns={[
            {
              key: "name",
              header: "Name",
              className: "font-medium",
              cell: (u) => (
                <>
                  {u.name}
                  {u.trustedLender && (
                    <BadgeCheck
                      className="ml-1 inline h-4 w-4 text-brand"
                      aria-label="Trusted Lender"
                    />
                  )}
                </>
              ),
            },
            { key: "email", header: "Email", className: "text-ink-soft", cell: (u) => u.email },
            {
              key: "role",
              header: "Role",
              className: "capitalize text-ink-soft",
              cell: (u) => u.role,
            },
            {
              key: "rating",
              header: "Rating",
              cell: (u) =>
                u.rating ? (
                  <Stars value={u.rating.average} count={u.rating.count} />
                ) : (
                  <span className="text-xs text-muted">—</span>
                ),
            },
          ]}
          renderActions={(u) => (
            <Button
              size="sm"
              variant={u.trustedLender ? "ghost" : "primary"}
              onClick={() => setChanging({ id: u._id, name: u.name, trusted: !u.trustedLender })}
            >
              {u.trustedLender ? "Remove Trusted" : "Mark Trusted"}
            </Button>
          )}
        />
      )}
      <Pager
        page={pager.page}
        from={pager.from}
        count={pager.rows.length}
        hasPrev={pager.hasPrev}
        hasNext={pager.hasNext}
        onPrev={pager.prev}
        onNext={pager.next}
        pageSize={pageSize}
        onPageSize={setPageSize}
      />
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

/** General audit log: one table for admin actions, loan changes and n8n automations. */
function ActivityLog() {
  const [kind, setKind] = useState<"all" | "admin" | "loan" | "automation">("all");
  const [pageSize, setPageSize] = useState(10);
  const [page, setPage] = useState(0);
  const feed = useQuery(api.activity.feed, { kind, offset: page * pageSize, pageSize });

  return (
    <div>
      <div className="mb-3">
        <FilterPills
          label="Filter audit log"
          value={kind}
          onChange={(k) => {
            setKind(k);
            setPage(0);
          }}
          options={[
            { value: "all", label: "Everything" },
            { value: "admin", label: "Admin actions" },
            { value: "loan", label: "Loan changes" },
            { value: "automation", label: "Automations" },
          ]}
        />
      </div>
      {feed === undefined ? (
        <Loading />
      ) : feed.entries.length === 0 ? (
        <Empty pip={false}>Nothing logged yet.</Empty>
      ) : (
        <EntityTable
          rows={feed.entries}
          rowKey={(e) => e.id}
          rowLabel={(e) => `${e.action} on ${e.target}`}
          caption="Audit log"
          columns={[
            {
              key: "when",
              header: "When",
              className: "whitespace-nowrap text-xs text-muted",
              cell: (e) => <span title={new Date(e.at).toLocaleString()}>{timeAgo(e.at)}</span>,
            },
            {
              key: "type",
              header: "Type",
              cell: (e) => (
                <span
                  className={`rounded-full px-2 py-0.5 text-xs font-semibold capitalize ${KIND_STYLES[e.kind]}`}
                >
                  {e.kind}
                </span>
              ),
            },
            { key: "who", header: "Who", className: "font-medium", cell: (e) => e.actor },
            {
              key: "action",
              header: "Action",
              className: "capitalize",
              cell: (e) => (
                <>
                  {e.action}
                  {!e.ok && <span className="ml-2 text-xs font-semibold text-danger">failed</span>}
                </>
              ),
            },
            { key: "on", header: "On", className: "text-ink-soft", cell: (e) => e.target },
          ]}
          renderExpanded={(e) => (
            <dl className="grid gap-3 rounded-2xl bg-white p-4 text-sm ring-1 ring-black/5 sm:grid-cols-3">
              <div>
                <dt className="text-xs uppercase tracking-wide text-muted">Exact time</dt>
                <dd className="mt-1">{new Date(e.at).toLocaleString()}</dd>
              </div>
              <div>
                <dt className="text-xs uppercase tracking-wide text-muted">Result</dt>
                <dd className={`mt-1 font-medium ${e.ok ? "text-ok" : "text-danger"}`}>
                  {e.ok ? "Succeeded" : "Failed"}
                </dd>
              </div>
              <div className="sm:col-span-3">
                <dt className="text-xs uppercase tracking-wide text-muted">Detail</dt>
                <dd className="mt-1 whitespace-pre-wrap break-words text-ink-soft">
                  {e.detail ?? "No extra detail recorded."}
                </dd>
              </div>
            </dl>
          )}
        />
      )}
      <Pager
        page={page + 1}
        from={page * pageSize + 1}
        count={feed?.entries.length ?? 0}
        hasPrev={page > 0}
        hasNext={feed?.hasMore ?? false}
        onPrev={() => setPage((p) => Math.max(p - 1, 0))}
        onNext={() => setPage((p) => p + 1)}
        pageSize={pageSize}
        onPageSize={(n) => {
          setPageSize(n);
          setPage(0);
        }}
      />
    </div>
  );
}
