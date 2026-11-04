"use client";

import { useMutation } from "convex/react";
import type { FunctionReturnType } from "convex/server";
import { BadgeCheck, CalendarClock, ChevronRight, MapPin, Pencil, Trash2 } from "lucide-react";
import Link from "next/link";
import { Fragment, useState } from "react";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import { CATEGORIES, CATEGORY_LABELS, type Category } from "@/convex/lib/constants";
import { CATEGORY_DOORS, CATEGORY_ICONS } from "../components/categoryIcons";
import {
  FilterPills,
  Pager,
  SearchField,
  ViewToggle,
  useDebounced,
  usePagedQuery,
  useViewMode,
} from "./collection";
import {
  ActionLink,
  AvailabilityBadge,
  Button,
  Empty,
  Loading,
  Stars,
  TextPromptDialog,
  formatDate,
  inputClass,
} from "./ui";

export type ToolRow = FunctionReturnType<typeof api.tools.browse>["page"][number];

const SORTS = [
  { value: "newest", label: "Newest" },
  { value: "oldest", label: "Oldest" },
  { value: "name", label: "Name A–Z" },
] as const;

/**
 * Paginated tool list with search, category filter, sort and a cards/table toggle.
 * `mine` shows only the viewer's tools with edit/delete; otherwise admins can remove any.
 */
export function BrowseTools({
  isAdmin = false,
  mine = false,
  onEdit,
}: {
  isAdmin?: boolean;
  mine?: boolean;
  onEdit?: (tool: ToolRow) => void;
}) {
  const [category, setCategory] = useState<Category | "">("");
  const [sort, setSort] = useState<"newest" | "oldest" | "name">("newest");
  const [term, setTerm] = useState("");
  const search = useDebounced(term);
  const [view, setView] = useViewMode(mine ? "mine" : "browse", mine ? "table" : "cards");
  const [removing, setRemoving] = useState<{ id: Id<"tools">; name: string; own: boolean } | null>(
    null,
  );
  const remove = useMutation(api.tools.remove);

  const [pageSize, setPageSize] = useState(10);
  const pager = usePagedQuery(
    api.tools.browse,
    { search, category: category || undefined, sort, mine },
    pageSize,
  );
  const results = pager.rows;

  const filtered = Boolean(search || category);

  return (
    <section>
      <div className="mb-6 flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
        <FilterPills
          label="Filter by category"
          value={category}
          onChange={setCategory}
          options={[
            { value: "" as const, label: "All" },
            ...CATEGORIES.map((c) => ({ value: c, label: CATEGORY_LABELS[c] })),
          ]}
        />
        <div className="flex flex-wrap items-center gap-2 xl:justify-end">
          <SearchField value={term} onChange={setTerm} placeholder="Search tools…" />
          <select
            aria-label="Sort"
            value={sort}
            disabled={Boolean(search)}
            title={search ? "Search results are sorted by relevance" : undefined}
            onChange={(e) => setSort(e.target.value as typeof sort)}
            className={`${inputClass} mt-0 w-auto py-1.5`}
          >
            {SORTS.map((s) => (
              <option key={s.value} value={s.value}>
                {s.label}
              </option>
            ))}
          </select>
          <ViewToggle mode={view} onChange={setView} />
        </div>
      </div>

      {pager.loading ? (
        <Loading />
      ) : results.length === 0 ? (
        filtered ? (
          <Empty
            action={
              <Button
                variant="ghost"
                onClick={() => {
                  setTerm("");
                  setCategory("");
                }}
              >
                Clear search and filters
              </Button>
            }
          >
            No tools match that search or category.
          </Empty>
        ) : (
          <Empty action={<ActionLink href="/dashboard?tab=listings">List a tool</ActionLink>}>
            {mine
              ? "You haven't listed any tools yet. Add your first drill or ladder to help a neighbor!"
              : "No tools in the neighborhood yet. Be the first to lend something."}
          </Empty>
        )
      ) : view === "cards" ? (
        <ul className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {results.map((tool, i) => (
            <ToolCard
              key={tool._id}
              tool={tool}
              index={i}
              actions={
                <RowActions
                  tool={tool}
                  isAdmin={isAdmin}
                  mine={mine}
                  onEdit={onEdit}
                  onRemove={setRemoving}
                />
              }
            />
          ))}
        </ul>
      ) : (
        <ToolTable
          tools={results}
          renderActions={(tool) => (
            <RowActions
              tool={tool}
              isAdmin={isAdmin}
              mine={mine}
              onEdit={onEdit}
              onRemove={setRemoving}
            />
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

      <TextPromptDialog
        open={removing !== null}
        title={removing?.own ? `Delete "${removing.name}"?` : `Remove "${removing?.name ?? ""}"?`}
        description={
          removing?.own
            ? "Open requests for it are cancelled. You can't undo this."
            : "The owner's open requests are cancelled. Your reason is saved in the audit log."
        }
        placeholder={removing?.own ? "Optional note" : "e.g. Duplicate listing, prohibited item…"}
        required={!removing?.own}
        danger
        confirmLabel={removing?.own ? "Delete" : "Remove listing"}
        onConfirm={(reason) =>
          remove(removing!.own ? { toolId: removing!.id } : { toolId: removing!.id, reason })
        }
        onClose={() => setRemoving(null)}
      />
    </section>
  );
}

function RowActions({
  tool,
  isAdmin,
  mine,
  onEdit,
  onRemove,
}: {
  tool: ToolRow;
  isAdmin: boolean;
  mine: boolean;
  onEdit?: (tool: ToolRow) => void;
  onRemove: (r: { id: Id<"tools">; name: string; own: boolean }) => void;
}) {
  if (mine && tool.isMine) {
    return (
      <div className="flex gap-2">
        {onEdit && (
          <Button size="sm" variant="ghost" onClick={() => onEdit(tool)}>
            <Pencil className="h-3.5 w-3.5" aria-hidden /> Edit
          </Button>
        )}
        <Button
          size="sm"
          variant="danger"
          onClick={() => onRemove({ id: tool._id, name: tool.name, own: true })}
        >
          <Trash2 className="h-3.5 w-3.5" aria-hidden /> Delete
        </Button>
      </div>
    );
  }
  if (isAdmin && !tool.isMine) {
    return (
      <Button
        size="sm"
        variant="danger"
        onClick={() => onRemove({ id: tool._id, name: tool.name, own: false })}
      >
        <Trash2 className="h-3.5 w-3.5" aria-hidden /> Remove
      </Button>
    );
  }
  return null;
}

/** Shown when a tool has no photo: its category "door" color with a large icon. */
export function ToolArt({
  tool,
  className = "",
  iconClass = "h-14 w-14",
}: {
  tool: { photoUrl: string | null; category: Category; name: string };
  className?: string;
  iconClass?: string;
}) {
  const Icon = CATEGORY_ICONS[tool.category];
  return tool.photoUrl ? (
    // eslint-disable-next-line @next/next/no-img-element -- Convex storage URLs are signed per request
    <img src={tool.photoUrl} alt={tool.name} className={`object-cover ${className}`} />
  ) : (
    <div
      className={`flex items-center justify-center text-ink/80 ${CATEGORY_DOORS[tool.category]} ${className}`}
      role="img"
      aria-label={`${CATEGORY_LABELS[tool.category]} (no photo yet)`}
    >
      <Icon className={iconClass} strokeWidth={1.3} aria-hidden />
    </div>
  );
}

/** "Booked Nov 20–22" so people see clashes before requesting. Dates only, never who. */
export function BookingNote({ availability }: { availability: ToolRow["availability"] }) {
  const next = availability.nextBooking;
  if (availability.status === "on_loan" || !next) return null;
  return (
    <span className="inline-flex items-center gap-1.5 text-xs text-warn">
      <CalendarClock className="h-3.5 w-3.5" aria-hidden />
      Booked {formatDate(next.startDate)}–{formatDate(next.endDate)}
    </span>
  );
}

function ToolCard({
  tool,
  index,
  actions,
}: {
  tool: ToolRow;
  index: number;
  actions: React.ReactNode;
}) {
  return (
    <li
      style={{ "--i": index } as React.CSSProperties}
      className="rise-in group flex flex-col rounded-[1.5rem] bg-white p-2 ring-1 ring-black/5 transition duration-300 hover:-translate-y-1 hover:shadow-lift"
    >
      <Link href={`/dashboard/tools/${tool._id}`} className="flex flex-1 flex-col">
        <div className="relative overflow-hidden rounded-[1.1rem]">
          <ToolArt
            tool={tool}
            className="aspect-[4/3] w-full transition-transform duration-500 group-hover:scale-105"
          />
          <span className="absolute left-2.5 top-2.5">
            <AvailabilityBadge availability={tool.availability} />
          </span>
        </div>
        <div className="flex flex-1 flex-col gap-1 px-2 pb-1 pt-3">
          <h3 className="font-sans text-base font-semibold leading-tight group-hover:text-brand">
            {tool.name}
          </h3>
          <p className="flex flex-wrap items-center gap-x-2 text-xs text-muted">
            {tool.neighborhood && (
              <span className="inline-flex items-center gap-1">
                <MapPin className="h-3 w-3" aria-hidden /> {tool.neighborhood}
              </span>
            )}
            <span>{CATEGORY_LABELS[tool.category]}</span>
            <span className="capitalize">· {tool.condition}</span>
          </p>
          <BookingNote availability={tool.availability} />
          <div className="mt-auto flex items-center justify-between pt-2 text-xs">
            <span className="inline-flex items-center gap-1 font-medium text-ink-soft">
              {tool.isMine ? "Yours" : tool.ownerName}
              {tool.ownerTrusted && (
                <BadgeCheck className="h-3.5 w-3.5 text-brand" aria-label="Trusted Lender" />
              )}
            </span>
            {tool.ownerRating && (
              <Stars value={tool.ownerRating.average} count={tool.ownerRating.count} />
            )}
          </div>
        </div>
      </Link>
      {actions && <div className="border-t border-line px-2 pt-2">{actions}</div>}
    </li>
  );
}

function ToolTable({
  tools,
  renderActions,
}: {
  tools: ToolRow[];
  renderActions: (tool: ToolRow) => React.ReactNode;
}) {
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const toggle = (id: string) =>
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  return (
    <div className="overflow-x-auto rounded-2xl bg-white ring-1 ring-black/5">
      <table className="w-full min-w-[760px] text-left text-sm">
        <thead className="border-b border-line text-xs uppercase tracking-wide text-muted">
          <tr>
            <th className="w-10 px-2 py-3">
              <span className="sr-only">Expand</span>
            </th>
            <th className="px-4 py-3 font-medium">Tool</th>
            <th className="px-4 py-3 font-medium">Category</th>
            <th className="px-4 py-3 font-medium">Owner</th>
            <th className="px-4 py-3 font-medium">Availability</th>
            <th className="px-4 py-3 font-medium">Rating</th>
            <th className="px-4 py-3 font-medium">
              <span className="sr-only">Actions</span>
            </th>
          </tr>
        </thead>
        <tbody className="divide-y divide-line">
          {tools.map((tool) => {
            const isOpen = expanded.has(tool._id);
            return (
              <Fragment key={tool._id}>
                <tr
                  className={`cursor-pointer hover:bg-paper/60 ${isOpen ? "bg-paper/60" : ""}`}
                  onClick={(e) => {
                    // Links and buttons inside the row keep their own behavior.
                    if (!(e.target as HTMLElement).closest("a,button")) toggle(tool._id);
                  }}
                >
                  <td className="px-2 py-3">
                    <button
                      type="button"
                      aria-expanded={isOpen}
                      aria-label={`${isOpen ? "Collapse" : "Expand"} ${tool.name}`}
                      onClick={() => toggle(tool._id)}
                      className="flex h-7 w-7 items-center justify-center rounded-lg text-muted hover:bg-white hover:text-ink"
                    >
                      <ChevronRight
                        className={`h-4 w-4 transition-transform duration-200 ${isOpen ? "rotate-90" : ""}`}
                      />
                    </button>
                  </td>
                  <td className="px-4 py-3">
                    <Link
                      href={`/dashboard/tools/${tool._id}`}
                      className="flex items-center gap-3 font-medium hover:text-brand"
                    >
                      <ToolArt
                        tool={tool}
                        className="h-10 w-10 shrink-0 rounded-lg"
                        iconClass="h-5 w-5"
                      />
                      <span>
                        {tool.name}
                        {tool.neighborhood && (
                          <span className="block text-xs font-normal text-muted">
                            {tool.neighborhood}
                          </span>
                        )}
                      </span>
                    </Link>
                  </td>
                  <td className="px-4 py-3 text-ink-soft">{CATEGORY_LABELS[tool.category]}</td>
                  <td className="px-4 py-3 text-ink-soft">
                    {tool.isMine ? "You" : tool.ownerName}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex flex-col items-start gap-1">
                      <AvailabilityBadge availability={tool.availability} />
                      <BookingNote availability={tool.availability} />
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    {tool.ownerRating ? (
                      <Stars value={tool.ownerRating.average} count={tool.ownerRating.count} />
                    ) : (
                      <span className="text-xs text-muted">—</span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-right">{renderActions(tool)}</td>
                </tr>
                {isOpen && (
                  <tr className="bg-paper/40">
                    <td colSpan={7} className="px-4 pb-4 pt-1">
                      <div className="grid gap-4 rounded-2xl bg-white p-4 ring-1 ring-black/5 sm:grid-cols-[200px_1fr]">
                        <ToolArt
                          tool={tool}
                          className="aspect-[4/3] w-full rounded-xl"
                          iconClass="h-12 w-12"
                        />
                        <div className="space-y-2 text-sm">
                          <p className="text-ink-soft">{tool.description}</p>
                          <p className="text-xs text-muted">
                            <span className="capitalize">{tool.condition}</span> condition ·{" "}
                            {CATEGORY_LABELS[tool.category]}
                            {tool.neighborhood && ` · ${tool.neighborhood}`}
                          </p>
                          <div className="flex flex-wrap items-center gap-2">
                            <AvailabilityBadge availability={tool.availability} />
                            <BookingNote availability={tool.availability} />
                          </div>
                          <Link
                            href={`/dashboard/tools/${tool._id}`}
                            className="inline-block pt-1 font-medium text-brand hover:underline"
                          >
                            {tool.isMine ? "Open tool page" : "View dates and request"} →
                          </Link>
                        </div>
                      </div>
                    </td>
                  </tr>
                )}
              </Fragment>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
