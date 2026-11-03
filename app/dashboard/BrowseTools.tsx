"use client";

import { useMutation, useQuery } from "convex/react";
import Link from "next/link";
import { useState } from "react";
import { api } from "@/convex/_generated/api";
import { CATEGORIES, CATEGORY_LABELS, type Category } from "@/convex/lib/constants";
import { Badge, Button, Empty, ErrorText, Stars, formatDate, inputClass, useAction } from "./ui";

export function BrowseTools({ isAdmin }: { isAdmin: boolean }) {
  const [category, setCategory] = useState<Category | "">("");
  const [search, setSearch] = useState("");
  const tools = useQuery(api.tools.list, category ? { category } : {});
  const remove = useMutation(api.tools.remove);
  const action = useAction();

  const term = search.trim().toLowerCase();
  const shown = tools?.filter(
    (t) =>
      !term || t.name.toLowerCase().includes(term) || t.description.toLowerCase().includes(term),
  );

  return (
    <section>
      <div className="mb-4 flex flex-wrap items-center gap-3">
        <input
          type="search"
          placeholder="Search tools…"
          aria-label="Search tools"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className={`${inputClass} max-w-xs`}
        />
        <select
          aria-label="Category"
          value={category}
          onChange={(e) => setCategory(e.target.value as Category | "")}
          className={`${inputClass} w-auto`}
        >
          <option value="">All categories</option>
          {CATEGORIES.map((c) => (
            <option key={c} value={c}>
              {CATEGORY_LABELS[c]}
            </option>
          ))}
        </select>
      </div>
      <ErrorText error={action.error} />

      {shown === undefined ? (
        <p className="text-stone-500">Loading…</p>
      ) : shown.length === 0 ? (
        <Empty>No tools match. Try another category or search.</Empty>
      ) : (
        <ul className="grid gap-4 sm:grid-cols-2">
          {shown.map((tool) => (
            <li
              key={tool._id}
              className="overflow-hidden rounded-xl border border-stone-200 bg-white"
            >
              <Link href={`/dashboard/tools/${tool._id}`} className="block hover:bg-stone-50">
                {tool.photoUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element -- Convex storage URLs are signed per request
                  <img src={tool.photoUrl} alt="" className="h-40 w-full object-cover" />
                ) : (
                  <div className="flex h-40 items-center justify-center bg-stone-100 text-sm text-stone-400">
                    No photo
                  </div>
                )}
                <div className="p-4">
                  <div className="flex items-start justify-between gap-2">
                    <h3 className="font-medium">{tool.name}</h3>
                    <Badge tone={tool.availability.status}>
                      {tool.availability.status === "available"
                        ? "Available"
                        : `Back ${formatDate(tool.availability.until!)}`}
                    </Badge>
                  </div>
                  <p className="mt-1 text-xs text-stone-500">
                    {tool.neighborhood && <>📍 {tool.neighborhood} · </>}
                    {CATEGORY_LABELS[tool.category]} · {tool.condition} ·{" "}
                    {tool.isMine ? "yours" : `by ${tool.ownerName}`}
                    {tool.ownerTrusted && <span className="text-emerald-700"> ★ Trusted</span>}
                  </p>
                  {tool.ownerRating && (
                    <Stars value={tool.ownerRating.average} count={tool.ownerRating.count} />
                  )}
                </div>
              </Link>
              {isAdmin && !tool.isMine && (
                <div className="border-t border-stone-100 px-4 py-2">
                  <Button
                    variant="danger"
                    disabled={action.pending}
                    onClick={() => {
                      // Temporary prompt until the redesign adds a proper dialog.
                      const reason = prompt(`Why remove "${tool.name}"? (saved in the audit log)`);
                      if (reason !== null) action.run(() => remove({ toolId: tool._id, reason }));
                    }}
                  >
                    Remove listing
                  </Button>
                </div>
              )}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
