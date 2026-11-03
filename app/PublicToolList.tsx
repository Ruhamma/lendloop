"use client";

import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { CATEGORY_LABELS } from "@/convex/lib/constants";
import { CATEGORY_ICONS } from "./components/categoryIcons";

export function PublicToolList() {
  const tools = useQuery(api.tools.publicList);

  if (tools === undefined) {
    return (
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3" aria-busy="true">
        {[0, 1, 2].map((i) => (
          <div key={i} className="h-20 animate-pulse rounded-card bg-line/60" />
        ))}
      </div>
    );
  }
  if (tools.length === 0) {
    return (
      <p className="rounded-card border border-dashed border-line px-6 py-10 text-center text-muted">
        No tools listed yet. Be the first to lend one.
      </p>
    );
  }
  return (
    <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
      {tools.map((tool) => {
        const Icon = CATEGORY_ICONS[tool.category];
        return (
          <li
            key={tool._id}
            className="flex items-center gap-4 rounded-card border border-line bg-surface p-4 shadow-card"
          >
            <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-brand-soft text-brand">
              <Icon className="h-6 w-6" aria-hidden />
            </span>
            <div className="min-w-0">
              <p className="truncate font-semibold">{tool.name}</p>
              <p className="text-sm text-muted">{CATEGORY_LABELS[tool.category]}</p>
            </div>
          </li>
        );
      })}
    </ul>
  );
}
