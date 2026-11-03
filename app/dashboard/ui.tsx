"use client";

import { ConvexError } from "convex/values";
import { useState, type ReactNode } from "react";

export function errorMessage(e: unknown) {
  if (e instanceof ConvexError && typeof e.data === "string") return e.data;
  return "Something went wrong. Please try again.";
}

/** Runs a mutation, tracks pending state, and surfaces Convex errors as text. */
export function useAction() {
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  async function run(fn: () => Promise<unknown>) {
    setPending(true);
    setError(null);
    try {
      await fn();
      return true;
    } catch (e) {
      setError(errorMessage(e));
      return false;
    } finally {
      setPending(false);
    }
  }
  return { pending, error, run };
}

export function timeAgo(ms: number) {
  const seconds = Math.round((Date.now() - ms) / 1000);
  if (seconds < 60) return "just now";
  const minutes = Math.round(seconds / 60);
  if (minutes < 60) return `${minutes} min ago`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours} h ago`;
  const days = Math.round(hours / 24);
  return `${days} day${days === 1 ? "" : "s"} ago`;
}

const STATUS_STYLES: Record<string, string> = {
  available: "bg-emerald-50 text-emerald-700",
  on_loan: "bg-amber-50 text-amber-700",
  pending: "bg-sky-50 text-sky-700",
  approved: "bg-emerald-50 text-emerald-700",
  declined: "bg-stone-100 text-stone-600",
  cancelled: "bg-stone-100 text-stone-600",
  returned: "bg-stone-100 text-stone-600",
  overdue: "bg-red-50 text-red-700",
};

export function Badge({ tone, children }: { tone: string; children: ReactNode }) {
  return (
    <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${STATUS_STYLES[tone] ?? ""}`}>
      {children}
    </span>
  );
}

export function Button({
  variant = "primary",
  ...props
}: React.ButtonHTMLAttributes<HTMLButtonElement> & { variant?: "primary" | "ghost" | "danger" }) {
  const styles = {
    primary: "bg-stone-900 text-white hover:bg-stone-700",
    ghost: "border border-stone-300 bg-white hover:bg-stone-50",
    danger: "border border-red-200 bg-white text-red-700 hover:bg-red-50",
  }[variant];
  return (
    <button
      {...props}
      className={`rounded-lg px-3 py-1.5 text-sm font-medium disabled:opacity-50 ${styles} ${props.className ?? ""}`}
    />
  );
}

export function ErrorText({ error }: { error: string | null }) {
  if (!error) return null;
  return (
    <p role="alert" className="mt-2 text-sm text-red-700">
      {error}
    </p>
  );
}

export function Empty({ children }: { children: ReactNode }) {
  return (
    <p className="rounded-xl border border-dashed border-stone-300 p-6 text-center text-stone-500">
      {children}
    </p>
  );
}

export const inputClass =
  "w-full rounded-lg border border-stone-300 bg-white px-3 py-2 text-sm focus:border-stone-500 focus:outline-none";

/** Read-only star rating, e.g. "★ 4.5 (3)". */
export function Stars({ value, count }: { value: number; count?: number }) {
  return (
    <span className="text-xs text-amber-700" aria-label={`Rated ${value} out of 5`}>
      ★ {value.toFixed(1)}
      {count !== undefined && <span className="text-stone-500"> ({count})</span>}
    </span>
  );
}

/** Clickable 1–5 star input. */
export function StarPicker({ value, onChange }: { value: number; onChange: (v: number) => void }) {
  return (
    <div role="radiogroup" aria-label="Rating" className="flex gap-1">
      {[1, 2, 3, 4, 5].map((n) => (
        <button
          key={n}
          type="button"
          role="radio"
          aria-checked={value === n}
          aria-label={`${n} star${n === 1 ? "" : "s"}`}
          onClick={() => onChange(n)}
          className={`text-xl ${n <= value ? "text-amber-500" : "text-stone-300"}`}
        >
          ★
        </button>
      ))}
    </div>
  );
}

export function formatDate(iso: string) {
  return new Date(`${iso}T00:00:00Z`).toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    timeZone: "UTC",
  });
}
