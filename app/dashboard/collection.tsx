"use client";

import { useQuery } from "convex/react";
import type {
  FunctionArgs,
  FunctionReference,
  FunctionReturnType,
  PaginationOptions,
  PaginationResult,
} from "convex/server";
import { ChevronLeft, ChevronRight, LayoutGrid, List, Search } from "lucide-react";
import { useEffect, useState } from "react";
import { inputClass } from "./ui";

/** Search text that only updates after typing pauses, so every keystroke isn't a query. */
export function useDebounced(value: string, ms = 250) {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const t = setTimeout(() => setDebounced(value), ms);
    return () => clearTimeout(t);
  }, [value, ms]);
  return debounced;
}

export type ViewMode = "cards" | "table";

/** Cards or table, remembered per list in this browser. */
export function useViewMode(key: string, fallback: ViewMode = "cards") {
  const storageKey = `ll-view-${key}`;
  const [mode, setMode] = useState<ViewMode>(() => {
    if (typeof window === "undefined") return fallback;
    try {
      const saved = localStorage.getItem(storageKey);
      return saved === "cards" || saved === "table" ? saved : fallback;
    } catch {
      return fallback;
    }
  });
  const change = (next: ViewMode) => {
    setMode(next);
    try {
      localStorage.setItem(storageKey, next);
    } catch {
      // Storage blocked: the choice just won't be remembered.
    }
  };
  return [mode, change] as const;
}

export function ViewToggle({
  mode,
  onChange,
}: {
  mode: ViewMode;
  onChange: (m: ViewMode) => void;
}) {
  const btn = (m: ViewMode, label: string, Icon: typeof List) => (
    <button
      type="button"
      aria-pressed={mode === m}
      aria-label={label}
      title={label}
      onClick={() => onChange(m)}
      className={`flex h-8 w-8 items-center justify-center rounded-lg transition-colors ${
        mode === m ? "bg-white text-ink shadow-card" : "text-muted hover:text-ink"
      }`}
    >
      <Icon className="h-4 w-4" />
    </button>
  );
  return (
    <div
      className="flex rounded-xl bg-paper p-1 ring-1 ring-black/5"
      role="group"
      aria-label="View"
    >
      {btn("cards", "Card view", LayoutGrid)}
      {btn("table", "Table view", List)}
    </div>
  );
}

export function SearchField({
  value,
  onChange,
  placeholder,
}: {
  value: string;
  onChange: (v: string) => void;
  placeholder: string;
}) {
  return (
    <div className="relative w-full sm:max-w-xs">
      <Search
        className="pointer-events-none absolute left-3 top-1/2 mt-0.5 h-4 w-4 -translate-y-1/2 text-muted"
        aria-hidden
      />
      <input
        type="search"
        placeholder={placeholder}
        aria-label={placeholder}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className={`${inputClass} pl-9`}
      />
    </div>
  );
}

/** Pill filter group, e.g. statuses or categories. */
export function FilterPills<T extends string>({
  options,
  value,
  onChange,
  label,
}: {
  options: { value: T; label: string }[];
  value: T;
  onChange: (v: T) => void;
  label: string;
}) {
  return (
    <div className="flex gap-2 overflow-x-auto pb-1" role="group" aria-label={label}>
      {options.map((o) => (
        <button
          key={o.value}
          type="button"
          aria-pressed={value === o.value}
          onClick={() => onChange(o.value)}
          className={`whitespace-nowrap rounded-full px-3 py-1.5 text-sm font-medium transition-colors ${
            value === o.value
              ? "bg-ink text-white"
              : "bg-white text-ink-soft ring-1 ring-black/10 hover:text-ink"
          }`}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

/**
 * Page-by-page navigation over a Convex cursor-paginated query. Convex pages by cursor, not
 * offset, so we remember the cursor that starts each page we've visited; Prev walks back
 * through them and Next uses the current page's continueCursor. Any change to the query
 * arguments (search, filters, sort, page size) starts again from page 1.
 */
export function usePagedQuery<
  Q extends FunctionReference<"query", "public", { paginationOpts: PaginationOptions }>,
>(query: Q, args: Omit<FunctionArgs<Q>, "paginationOpts">, pageSize: number) {
  const key = JSON.stringify({ args, pageSize });
  const [state, setState] = useState<{ key: string; cursors: (string | null)[] }>({
    key,
    cursors: [null],
  });
  // Reset to page 1 when the query changes (adjusting state during render, React's pattern).
  const current = state.key === key ? state : { key, cursors: [null] };
  if (current !== state) setState(current);

  const index = current.cursors.length - 1;
  // useQuery's argument types can't be inferred through this generic wrapper; the call
  // shape is checked by each caller's FunctionArgs instead.
  const runQuery = useQuery as unknown as (q: Q, a: FunctionArgs<Q>) => unknown;
  const result = runQuery(query, {
    ...args,
    paginationOpts: { numItems: pageSize, cursor: current.cursors[index] },
  } as FunctionArgs<Q>) as PaginationResult<FunctionReturnType<Q>["page"][number]> | undefined;

  return {
    rows: (result?.page ?? []) as FunctionReturnType<Q>["page"],
    loading: result === undefined,
    page: index + 1,
    from: index * pageSize + 1,
    hasNext: result ? !result.isDone : false,
    hasPrev: index > 0,
    next: () =>
      result &&
      !result.isDone &&
      setState({ key, cursors: [...current.cursors, result.continueCursor] }),
    prev: () => index > 0 && setState({ key, cursors: current.cursors.slice(0, -1) }),
  };
}

export const PAGE_SIZES = [10, 25, 50] as const;

/** Prev · Page N · Next, a "Showing a–b" summary and a rows-per-page picker. Always visible. */
export function Pager({
  page,
  from,
  count,
  hasPrev,
  hasNext,
  onPrev,
  onNext,
  pageSize,
  onPageSize,
}: {
  page: number;
  from: number;
  count: number;
  hasPrev: boolean;
  hasNext: boolean;
  onPrev: () => void;
  onNext: () => void;
  pageSize: number;
  onPageSize: (n: number) => void;
}) {
  return (
    <nav
      aria-label="Pagination"
      className="mt-4 flex flex-wrap items-center justify-between gap-3 rounded-2xl bg-white px-4 py-3 text-sm ring-1 ring-black/5"
    >
      <span className="text-muted">
        {count === 0 ? "No results" : `Showing ${from}–${from + count - 1}`}
        {!hasNext && count > 0 && page === 1 ? " (all)" : ""}
      </span>
      <div className="flex items-center gap-2">
        <label className="flex items-center gap-2 text-muted">
          Rows
          <select
            value={pageSize}
            onChange={(e) => onPageSize(Number(e.target.value))}
            className="rounded-lg border border-line bg-white px-2 py-1 text-ink"
          >
            {PAGE_SIZES.map((n) => (
              <option key={n} value={n}>
                {n}
              </option>
            ))}
          </select>
        </label>
        <button
          type="button"
          onClick={onPrev}
          disabled={!hasPrev}
          className="inline-flex items-center gap-1 rounded-lg px-3 py-1.5 font-medium ring-1 ring-black/10 hover:bg-paper disabled:opacity-40"
        >
          <ChevronLeft className="h-4 w-4" aria-hidden /> Prev
        </button>
        <span className="min-w-16 text-center font-medium" aria-current="page">
          Page {page}
        </span>
        <button
          type="button"
          onClick={onNext}
          disabled={!hasNext}
          className="inline-flex items-center gap-1 rounded-lg px-3 py-1.5 font-medium ring-1 ring-black/10 hover:bg-paper disabled:opacity-40"
        >
          Next <ChevronRight className="h-4 w-4" aria-hidden />
        </button>
      </div>
    </nav>
  );
}
