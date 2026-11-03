import { ConvexError } from "convex/values";

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

/** Today's date in UTC as YYYY-MM-DD. Loans are day-granular, so UTC is good enough here. */
export function todayIso(now = Date.now()): string {
  return new Date(now).toISOString().slice(0, 10);
}

export function assertIsoDate(value: string, label: string) {
  if (!ISO_DATE.test(value) || Number.isNaN(Date.parse(value))) {
    throw new ConvexError(`${label} must be a date (YYYY-MM-DD)`);
  }
}

/** Inclusive date ranges overlap when each starts before the other ends. */
export function rangesOverlap(aStart: string, aEnd: string, bStart: string, bEnd: string) {
  return aStart <= bEnd && bStart <= aEnd;
}
