import {
  CookingPot,
  Drill,
  Hammer,
  Package,
  Shovel,
  SprayCan,
  Tent,
  type LucideIcon,
} from "lucide-react";
import type { Category } from "@/convex/lib/constants";

export const CATEGORY_ICONS: Record<Category, LucideIcon> = {
  power_tools: Drill,
  hand_tools: Hammer,
  garden: Shovel,
  kitchen: CookingPot,
  camping: Tent,
  cleaning: SprayCan,
  other: Package,
};

/** Each category gets its own "front door" color. Ink text reads at 7:1+ on all of them. */
export const CATEGORY_DOORS: Record<Category, string> = {
  power_tools: "bg-sun",
  hand_tools: "bg-sky",
  garden: "bg-lav",
  kitchen: "bg-coral",
  camping: "bg-sky",
  cleaning: "bg-lav",
  other: "bg-sun",
};
