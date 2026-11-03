import { ConvexError } from "convex/values";

/** Trim and length-check user text. Rendering is escaped by React, so no HTML sanitizing is needed. */
export function cleanText(value: string, label: string, max: number) {
  const trimmed = value.trim();
  if (!trimmed) throw new ConvexError(`${label} is required`);
  if (trimmed.length > max) throw new ConvexError(`${label} must be at most ${max} characters`);
  return trimmed;
}

/** Like cleanText, but an empty value becomes undefined instead of an error. */
export function optionalText(value: string | undefined, label: string, max: number) {
  if (value === undefined || !value.trim()) return undefined;
  return cleanText(value, label, max);
}
