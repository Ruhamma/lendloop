"use client";

import { useConvexAuth, useQuery } from "convex/react";
import { ArrowRight, Search, X } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useId, useRef, useState, useSyncExternalStore } from "react";
import { api } from "@/convex/_generated/api";
import { CATEGORY_LABELS } from "@/convex/lib/constants";
import { CATEGORY_DOORS, CATEGORY_ICONS } from "./categoryIcons";

const MAX_RESULTS = 6;

/**
 * Tool search for the navbar. Grows when focused, suggests matches as you type, and works
 * fully from the keyboard (arrows, Enter, Escape) as an ARIA combobox. Signed-out visitors
 * search the public list (name and category only) and are asked to sign in on select.
 */
export function SearchBox() {
  const { isAuthenticated } = useConvexAuth();
  const publicTools = useQuery(api.tools.publicList, isAuthenticated ? "skip" : {});
  const myTools = useQuery(api.tools.list, isAuthenticated ? {} : "skip");
  const tools = (isAuthenticated ? myTools : publicTools) ?? [];

  const router = useRouter();
  const listId = useId();
  const inputRef = useRef<HTMLInputElement>(null);
  const [term, setTerm] = useState("");
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);

  // ⌘K / Ctrl+K (or "/" when not typing elsewhere) jumps to search from anywhere.
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      const el = e.target as HTMLElement | null;
      const typing = el?.isContentEditable || el?.tagName === "INPUT" || el?.tagName === "TEXTAREA";
      if ((e.key.toLowerCase() === "k" && (e.metaKey || e.ctrlKey)) || (e.key === "/" && !typing)) {
        e.preventDefault();
        inputRef.current?.focus();
        inputRef.current?.select();
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);
  // "⌘K" on Mac, "Ctrl K" elsewhere; the server always renders "Ctrl K".
  const isMac = useSyncExternalStore(
    () => () => {},
    () => /Mac|iPhone|iPad/.test(navigator.platform),
    () => false,
  );

  const needle = term.trim().toLowerCase();
  const results = tools
    .filter(
      (t) =>
        !needle ||
        t.name.toLowerCase().includes(needle) ||
        CATEGORY_LABELS[t.category].toLowerCase().includes(needle),
    )
    .slice(0, MAX_RESULTS);

  function choose(toolId: string) {
    const href = `/dashboard/tools/${toolId}`;
    setOpen(false);
    setTerm("");
    router.push(isAuthenticated ? href : `/sign-in?redirect_url=${encodeURIComponent(href)}`);
  }

  function onKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setOpen(true);
      setActive((i) => Math.min(i + 1, results.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActive((i) => Math.max(i - 1, 0));
    } else if (e.key === "Enter" && open && results[active]) {
      e.preventDefault();
      choose(results[active]._id);
    } else if (e.key === "Escape") {
      setOpen(false);
      inputRef.current?.blur();
    }
  }

  return (
    <div className="relative w-full max-w-md">
      <div
        className={`flex items-center gap-2 rounded-full border px-4 transition-all duration-300 ease-out ${
          open
            ? "border-zinc-300 bg-white shadow-lift ring-4 ring-zinc-900/5"
            : "border-transparent bg-zinc-100 hover:bg-zinc-200/70"
        }`}
      >
        <Search
          className={`h-4 w-4 shrink-0 transition-colors duration-300 ${open ? "text-zinc-900" : "text-zinc-500"}`}
          aria-hidden
        />
        <input
          ref={inputRef}
          role="combobox"
          aria-expanded={open}
          aria-controls={listId}
          aria-autocomplete="list"
          aria-activedescendant={open && results[active] ? `${listId}-${active}` : undefined}
          aria-label="Search tools"
          placeholder="Search drills, ladders, tents…"
          value={term}
          onChange={(e) => {
            setTerm(e.target.value);
            setActive(0);
            setOpen(true);
          }}
          onFocus={() => setOpen(true)}
          onBlur={() => setOpen(false)}
          onKeyDown={onKeyDown}
          className="h-9 w-full bg-transparent text-sm text-zinc-900 placeholder:text-zinc-500 focus:outline-none"
        />
        {!term && !open && (
          <kbd className="hidden shrink-0 rounded-md border border-zinc-300 bg-white px-1.5 py-0.5 font-sans text-[11px] font-medium text-zinc-500 sm:inline-block">
            {isMac ? "⌘K" : "Ctrl K"}
          </kbd>
        )}
        {term && (
          <button
            type="button"
            aria-label="Clear search"
            onMouseDown={(e) => e.preventDefault()}
            onClick={() => {
              setTerm("");
              inputRef.current?.focus();
            }}
            className="rounded-full p-1 text-muted hover:bg-paper hover:text-ink"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        )}
      </div>

      {open && (
        <div className="search-pop absolute left-0 right-0 top-full z-50 mt-2 overflow-hidden rounded-2xl border border-line bg-surface shadow-lift">
          <p className="px-4 pb-1 pt-3 text-xs font-semibold uppercase tracking-wide text-muted">
            {needle ? "Matching tools" : "Available now"}
          </p>
          {results.length === 0 ? (
            <p className="px-4 pb-4 pt-1 text-sm text-muted">
              {tools.length === 0 ? "No tools listed yet." : `Nothing matches “${term.trim()}”.`}
            </p>
          ) : (
            <ul id={listId} role="listbox" aria-label="Tools" className="p-2">
              {results.map((tool, i) => {
                const Icon = CATEGORY_ICONS[tool.category];
                return (
                  <li
                    key={tool._id}
                    id={`${listId}-${i}`}
                    role="option"
                    aria-selected={i === active}
                    // Keep focus in the input so the list doesn't close before the click lands.
                    onMouseDown={(e) => e.preventDefault()}
                    onMouseEnter={() => setActive(i)}
                    onClick={() => choose(tool._id)}
                    className={`flex cursor-pointer items-center gap-3 rounded-xl px-2 py-2 transition-colors ${
                      i === active ? "bg-paper" : ""
                    }`}
                  >
                    <span
                      className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-ink ${CATEGORY_DOORS[tool.category]}`}
                    >
                      <Icon className="h-4 w-4" aria-hidden />
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-semibold">{tool.name}</span>
                      <span className="block text-xs text-muted">
                        {CATEGORY_LABELS[tool.category]}
                      </span>
                    </span>
                    <ArrowRight
                      className={`h-4 w-4 text-brand transition-all ${
                        i === active ? "translate-x-0 opacity-100" : "-translate-x-1 opacity-0"
                      }`}
                      aria-hidden
                    />
                  </li>
                );
              })}
            </ul>
          )}
          {!isAuthenticated && (
            <p className="border-t border-line px-4 py-2.5 text-xs text-muted">
              Sign in to see details and request a tool.
            </p>
          )}
        </div>
      )}
    </div>
  );
}
