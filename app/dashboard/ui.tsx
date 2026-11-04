"use client";

import { ConvexError } from "convex/values";
import { Star } from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { useEffect, useRef, useState, type ReactNode } from "react";

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

export function formatDate(iso: string) {
  return new Date(`${iso}T00:00:00Z`).toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    timeZone: "UTC",
  });
}

// Status colors: green = available, amber = waiting on someone, blue = in progress,
// red = needs attention now, gray = finished. All pairs pass WCAG AA (4.5:1+).
const TONES = {
  green: "bg-ok-soft text-ok",
  amber: "bg-warn-soft text-warn",
  blue: "bg-info-soft text-info",
  red: "bg-danger-soft text-danger",
  gray: "bg-paper text-ink-soft ring-1 ring-inset ring-line",
} as const;
type Tone = keyof typeof TONES;

export function Badge({
  tone,
  pulse = false,
  children,
}: {
  tone: Tone;
  pulse?: boolean;
  children: ReactNode;
}) {
  return (
    <span
      className={`inline-flex shrink-0 items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-semibold ${TONES[tone]}`}
    >
      {pulse && (
        // The ping animation is switched off for people who prefer reduced motion (globals.css).
        <span className="relative flex h-2 w-2" aria-hidden>
          <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-danger opacity-75" />
          <span className="relative inline-flex h-2 w-2 rounded-full bg-danger" />
        </span>
      )}
      {children}
    </span>
  );
}

const LOAN_STATUS: Record<string, { tone: Tone; label: string }> = {
  pending: { tone: "amber", label: "Pending approval" },
  approved: { tone: "blue", label: "Active loan" },
  returned: { tone: "gray", label: "Returned" },
  declined: { tone: "gray", label: "Declined" },
  cancelled: { tone: "gray", label: "Cancelled" },
};

export function LoanStatusBadge({ status, overdue }: { status: string; overdue: boolean }) {
  if (overdue) {
    return (
      <Badge tone="red" pulse>
        Overdue
      </Badge>
    );
  }
  const { tone, label } = LOAN_STATUS[status] ?? { tone: "gray" as const, label: status };
  return <Badge tone={tone}>{label}</Badge>;
}

export function AvailabilityBadge({
  availability,
}: {
  availability: { status: "available" | "on_loan"; until: string | null; overdue?: boolean };
}) {
  if (availability.status === "available") return <Badge tone="green">Available</Badge>;
  return availability.overdue ? (
    <Badge tone="red" pulse>
      Overdue · was due {formatDate(availability.until!)}
    </Badge>
  ) : (
    <Badge tone="blue">On loan · back {formatDate(availability.until!)}</Badge>
  );
}

/** Whole days between a past ISO date and today (UTC). */
export function daysSince(iso: string) {
  return Math.max(
    0,
    Math.round((Date.parse(new Date().toISOString().slice(0, 10)) - Date.parse(iso)) / 86_400_000),
  );
}

export function Button({
  variant = "primary",
  size = "md",
  ...props
}: React.ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: "primary" | "ghost" | "danger";
  size?: "sm" | "md";
}) {
  const styles = {
    primary: "bg-brand text-white hover:bg-brand-hover",
    ghost: "border border-line bg-surface text-ink hover:bg-paper",
    danger: "border border-danger/30 bg-surface text-danger hover:bg-danger-soft",
  }[variant];
  const sizes = { sm: "px-3 py-1.5 text-sm", md: "px-4 py-2 text-sm" }[size];
  return (
    <button
      {...props}
      className={`inline-flex items-center justify-center gap-1.5 rounded-full font-semibold transition-colors disabled:cursor-not-allowed disabled:opacity-50 ${styles} ${sizes} ${props.className ?? ""}`}
    />
  );
}

export function Card({ children, className = "" }: { children: ReactNode; className?: string }) {
  return (
    <div className={`rounded-card border border-line bg-surface shadow-card ${className}`}>
      {children}
    </div>
  );
}

export function ErrorText({ error }: { error: string | null }) {
  if (!error) return null;
  return (
    <p role="alert" className="mt-2 text-sm font-medium text-danger">
      {error}
    </p>
  );
}

/** Empty list: say what's missing, why it matters, and offer the next step. */
export function Empty({
  icon,
  action,
  pip = true,
  children,
}: {
  icon?: ReactNode;
  action?: ReactNode;
  /** Show Pip with the tape measure, looking around for something to borrow. */
  pip?: boolean;
  children: ReactNode;
}) {
  return (
    <div className="flex flex-col items-center gap-3 rounded-card border border-dashed border-line bg-surface/60 px-6 py-10 text-center text-muted">
      {pip ? <Image src="/mascot/pip-tape-measure.png" alt="" width={180} height={125} /> : icon}
      <p className="max-w-sm">{children}</p>
      {action}
    </div>
  );
}

/** Link styled as a primary button, for empty-state calls to action. */
export function ActionLink({ href, children }: { href: string; children: ReactNode }) {
  return (
    <Link
      href={href}
      className="inline-flex items-center gap-1.5 rounded-full bg-brand px-4 py-2 text-sm font-semibold text-white hover:bg-brand-hover"
    >
      {children}
    </Link>
  );
}

export function Loading() {
  return (
    <div className="grid gap-4 sm:grid-cols-2" aria-busy="true" aria-label="Loading">
      {[0, 1].map((i) => (
        <div key={i} className="h-40 animate-pulse rounded-card bg-line/60" />
      ))}
    </div>
  );
}

export const inputClass =
  "mt-1 w-full rounded-card border border-line bg-surface shadow-card px-3 py-2 text-sm text-ink placeholder:text-muted/70 focus:border-brand focus:outline-none focus:ring-2 focus:ring-brand/20";

export const labelClass = "block text-sm font-medium text-ink";

/** Read-only star rating, e.g. "★ 4.5 (3)". */
export function Stars({ value, count }: { value: number; count?: number }) {
  return (
    <span
      className="inline-flex items-center gap-1 text-xs font-semibold text-ink"
      aria-label={`Rated ${value} out of 5${count !== undefined ? ` from ${count} ratings` : ""}`}
    >
      <Star className="h-3.5 w-3.5 fill-accent text-accent" aria-hidden />
      {value.toFixed(1)}
      {count !== undefined && <span className="font-normal text-muted">({count})</span>}
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
        >
          <Star
            className={`h-7 w-7 transition-colors ${n <= value ? "fill-accent text-accent" : "text-line"}`}
          />
        </button>
      ))}
    </div>
  );
}

/**
 * Asks for a short text answer in a native <dialog>, which brings focus trapping,
 * Escape to close and an inert background for free.
 */
export function TextPromptDialog({
  open,
  title,
  description,
  placeholder,
  required = false,
  confirmLabel,
  danger = false,
  onConfirm,
  onClose,
}: {
  open: boolean;
  title: string;
  description?: string;
  placeholder?: string;
  required?: boolean;
  confirmLabel: string;
  danger?: boolean;
  onConfirm: (text: string) => Promise<unknown>;
  onClose: () => void;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  const [text, setText] = useState("");
  const action = useAction();

  useEffect(() => {
    const dialog = ref.current;
    if (!dialog) return;
    if (open && !dialog.open) dialog.showModal();
    if (!open && dialog.open) dialog.close();
  }, [open]);

  return (
    <dialog
      ref={ref}
      onClose={() => {
        setText("");
        onClose();
      }}
      className="m-auto w-[min(28rem,calc(100%-2rem))] rounded-card border border-line bg-surface p-0 text-ink shadow-lift backdrop:bg-ink/40"
    >
      <form
        className="space-y-3 p-6"
        onSubmit={async (e) => {
          e.preventDefault();
          if (await action.run(() => onConfirm(text))) ref.current?.close();
        }}
      >
        <h2 className="text-lg font-bold">{title}</h2>
        {description && <p className="text-sm text-muted">{description}</p>}
        <textarea
          autoFocus
          rows={3}
          maxLength={200}
          required={required}
          placeholder={placeholder}
          value={text}
          onChange={(e) => setText(e.target.value)}
          className={inputClass}
        />
        <ErrorText error={action.error} />
        <div className="flex justify-end gap-2 pt-1">
          <Button type="button" variant="ghost" onClick={() => ref.current?.close()}>
            Cancel
          </Button>
          <Button type="submit" variant={danger ? "danger" : "primary"} disabled={action.pending}>
            {confirmLabel}
          </Button>
        </div>
      </form>
    </dialog>
  );
}
