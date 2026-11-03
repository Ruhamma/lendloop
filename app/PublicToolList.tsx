"use client";

import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { CATEGORY_LABELS } from "@/convex/lib/constants";

export function PublicToolList() {
  const tools = useQuery(api.tools.publicList);

  if (tools === undefined) return <p className="text-stone-500">Loading tools…</p>;
  if (tools.length === 0) {
    return <p className="text-stone-500">No tools listed yet. Be the first to lend one.</p>;
  }
  return (
    <ul className="divide-y divide-stone-200 rounded-xl border border-stone-200 bg-white">
      {tools.map((tool) => (
        <li key={tool._id} className="flex items-center justify-between px-4 py-3">
          <span className="font-medium">{tool.name}</span>
          <span className="text-sm text-stone-500">{CATEGORY_LABELS[tool.category]}</span>
        </li>
      ))}
    </ul>
  );
}
