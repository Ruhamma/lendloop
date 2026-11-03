"use client";

import { useQuery } from "convex/react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { api } from "@/convex/_generated/api";
import { AdminPanel } from "./AdminPanel";
import { BrowseTools } from "./BrowseTools";
import { LoanList } from "./LoanList";
import { MyListings } from "./MyListings";

const TABS = [
  { id: "browse", label: "All tools" },
  { id: "listings", label: "My listings" },
  { id: "requests", label: "My requests" },
  { id: "incoming", label: "Incoming requests" },
  { id: "admin", label: "Admin" },
] as const;
type Tab = (typeof TABS)[number]["id"];

export default function Dashboard() {
  const me = useQuery(api.users.me);
  // The tab lives in the URL so "back" from a tool page returns to the same view.
  const requested = useSearchParams().get("tab");
  const isAdmin = me?.role === "admin";
  const tabs = TABS.filter((t) => t.id !== "admin" || isAdmin);
  const tab: Tab = tabs.find((t) => t.id === requested)?.id ?? "browse";

  return (
    <>
      <nav
        className="mb-6 flex gap-1 overflow-x-auto border-b border-stone-200"
        aria-label="Sections"
      >
        {tabs.map((t) => (
          <Link
            key={t.id}
            href={`/dashboard?tab=${t.id}`}
            aria-current={tab === t.id ? "page" : undefined}
            className={`whitespace-nowrap border-b-2 px-3 py-2 text-sm font-medium ${
              tab === t.id
                ? "border-stone-900"
                : "border-transparent text-stone-500 hover:text-stone-800"
            }`}
          >
            {t.label}
          </Link>
        ))}
      </nav>

      {!me ? (
        <p className="text-stone-500">Loading…</p>
      ) : (
        <>
          {tab === "browse" && <BrowseTools isAdmin={isAdmin} />}
          {tab === "listings" && <MyListings />}
          {tab === "requests" && <LoanList view="borrower" />}
          {tab === "incoming" && <LoanList view="owner" />}
          {tab === "admin" && isAdmin && <AdminPanel />}
        </>
      )}
    </>
  );
}
