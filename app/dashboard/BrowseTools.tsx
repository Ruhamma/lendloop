"use client";

import { useMutation, useQuery } from "convex/react";
import { BadgeCheck, MapPin, Search, Trash2 } from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import { CATEGORIES, CATEGORY_LABELS, type Category } from "@/convex/lib/constants";
import { CATEGORY_ICONS } from "../components/categoryIcons";
import {
  ActionLink,
  AvailabilityBadge,
  Button,
  Empty,
  Loading,
  Stars,
  TextPromptDialog,
  inputClass,
} from "./ui";

export function BrowseTools({ isAdmin }: { isAdmin: boolean }) {
  const [category, setCategory] = useState<Category | "">("");
  const [search, setSearch] = useState("");
  const [removing, setRemoving] = useState<{ id: Id<"tools">; name: string } | null>(null);
  const tools = useQuery(api.tools.list, category ? { category } : {});
  const remove = useMutation(api.tools.remove);

  const term = search.trim().toLowerCase();
  const shown = tools?.filter(
    (t) =>
      !term || t.name.toLowerCase().includes(term) || t.description.toLowerCase().includes(term),
  );

  return (
    <section>
      <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="relative w-full sm:max-w-xs">
          <Search
            className="pointer-events-none absolute left-3 top-1/2 mt-0.5 h-4 w-4 -translate-y-1/2 text-muted"
            aria-hidden
          />
          <input
            type="search"
            placeholder="Search tools…"
            aria-label="Search tools"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className={`${inputClass} pl-9`}
          />
        </div>
        <div
          className="flex gap-2 overflow-x-auto pb-1"
          role="group"
          aria-label="Filter by category"
        >
          {(["", ...CATEGORIES] as const).map((c) => {
            const Icon = c ? CATEGORY_ICONS[c] : null;
            const active = category === c;
            return (
              <button
                key={c || "all"}
                type="button"
                aria-pressed={active}
                onClick={() => setCategory(c)}
                className={`inline-flex items-center gap-1.5 whitespace-nowrap rounded-full px-3 py-1.5 text-sm font-medium ${
                  active
                    ? "bg-brand text-white"
                    : "border border-line bg-surface text-muted hover:text-ink"
                }`}
              >
                {Icon && <Icon className="h-4 w-4" aria-hidden />}
                {c ? CATEGORY_LABELS[c] : "All"}
              </button>
            );
          })}
        </div>
      </div>

      {shown === undefined ? (
        <Loading />
      ) : shown.length === 0 ? (
        tools?.length === 0 ? (
          <Empty
            icon={<Search className="h-6 w-6" aria-hidden />}
            action={<ActionLink href="/dashboard?tab=listings">List the first tool</ActionLink>}
          >
            No tools in the neighborhood yet. Be the first to lend something, even a ladder helps
            someone this weekend.
          </Empty>
        ) : (
          <Empty
            icon={<Search className="h-6 w-6" aria-hidden />}
            action={
              <Button
                variant="ghost"
                onClick={() => {
                  setSearch("");
                  setCategory("");
                }}
              >
                Clear search and filters
              </Button>
            }
          >
            No tools match that search or category.
          </Empty>
        )
      ) : (
        <ul className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {shown.map((tool) => {
            const Icon = CATEGORY_ICONS[tool.category];
            return (
              <li
                key={tool._id}
                className="group flex flex-col overflow-hidden rounded-card border border-line bg-surface shadow-card transition-shadow hover:shadow-lift"
              >
                <Link href={`/dashboard/tools/${tool._id}`} className="flex flex-1 flex-col">
                  <div className="relative">
                    {tool.photoUrl ? (
                      // eslint-disable-next-line @next/next/no-img-element -- Convex storage URLs are signed per request
                      <img
                        src={tool.photoUrl}
                        alt=""
                        className="aspect-[4/3] w-full object-cover"
                      />
                    ) : (
                      <div className="flex aspect-[4/3] items-center justify-center bg-brand-soft text-brand">
                        <Icon className="h-12 w-12" aria-hidden />
                      </div>
                    )}
                    <span className="absolute left-3 top-3">
                      <AvailabilityBadge availability={tool.availability} />
                    </span>
                  </div>
                  <div className="flex flex-1 flex-col gap-1.5 p-4">
                    <h3 className="text-lg font-bold leading-tight group-hover:text-brand">
                      {tool.name}
                    </h3>
                    <p className="flex flex-wrap items-center gap-x-2 text-sm text-muted">
                      {tool.neighborhood && (
                        <span className="inline-flex items-center gap-1">
                          <MapPin className="h-3.5 w-3.5" aria-hidden /> {tool.neighborhood}
                        </span>
                      )}
                      <span>{CATEGORY_LABELS[tool.category]}</span>
                      <span className="capitalize">· {tool.condition}</span>
                    </p>
                    <div className="mt-auto flex items-center justify-between pt-2 text-sm">
                      <span className="inline-flex items-center gap-1 font-medium">
                        {tool.isMine ? "Yours" : tool.ownerName}
                        {tool.ownerTrusted && (
                          <BadgeCheck className="h-4 w-4 text-brand" aria-label="Trusted Lender" />
                        )}
                      </span>
                      {tool.ownerRating && (
                        <Stars value={tool.ownerRating.average} count={tool.ownerRating.count} />
                      )}
                    </div>
                  </div>
                </Link>
                {isAdmin && !tool.isMine && (
                  <div className="border-t border-line px-4 py-2">
                    <Button
                      variant="danger"
                      size="sm"
                      onClick={() => setRemoving({ id: tool._id, name: tool.name })}
                    >
                      <Trash2 className="h-4 w-4" aria-hidden /> Remove listing
                    </Button>
                  </div>
                )}
              </li>
            );
          })}
        </ul>
      )}

      <TextPromptDialog
        open={removing !== null}
        title={`Remove "${removing?.name ?? ""}"?`}
        description="The owner's open requests are cancelled. Your reason is saved in the audit log."
        placeholder="e.g. Duplicate listing, prohibited item…"
        required
        danger
        confirmLabel="Remove listing"
        onConfirm={(reason) => remove({ toolId: removing!.id, reason })}
        onClose={() => setRemoving(null)}
      />
    </section>
  );
}
