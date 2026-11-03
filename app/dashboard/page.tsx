"use client";

import { useQuery } from "convex/react";
import { Inbox, LayoutGrid, Package, Send, ShieldCheck } from "lucide-react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { api } from "@/convex/_generated/api";
import { AdminPanel } from "./AdminPanel";
import { BrowseTools } from "./BrowseTools";
import { LoanList } from "./LoanList";
import { MyListings } from "./MyListings";
import { Loading } from "./ui";

const TABS = [
  { id: "browse", label: "All tools", icon: LayoutGrid },
  { id: "listings", label: "My listings", icon: Package },
  { id: "requests", label: "My requests", icon: Send },
  { id: "incoming", label: "Incoming requests", icon: Inbox },
  { id: "admin", label: "Admin", icon: ShieldCheck },
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
      <nav className="mb-8 flex gap-2 overflow-x-auto pb-1" aria-label="Sections">
        {tabs.map((t) => (
          <Link
            key={t.id}
            href={`/dashboard?tab=${t.id}`}
            aria-current={tab === t.id ? "page" : undefined}
            className={`inline-flex items-center gap-2 whitespace-nowrap rounded-full px-4 py-2 text-sm font-semibold transition-colors ${
              tab === t.id
                ? "bg-ink text-white"
                : "border border-line bg-surface text-muted hover:text-ink"
            }`}
          >
            <t.icon className="h-4 w-4" aria-hidden />
            {t.label}
          </Link>
        ))}
      </nav>

      {!me ? (
        <Loading />
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
