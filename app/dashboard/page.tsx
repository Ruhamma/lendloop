"use client";

import { useQuery } from "convex/react";
import { useSearchParams } from "next/navigation";
import { api } from "@/convex/_generated/api";
import { AdminPanel } from "./AdminPanel";
import { BrowseTools } from "./BrowseTools";
import { TABS, type Tab } from "./DashboardShell";
import { LoanList } from "./LoanList";
import { MyListings } from "./MyListings";
import { Overview } from "./Overview";
import { Loading } from "./ui";

const TITLES: Record<Tab, { title: string; subtitle: string }> = {
  overview: { title: "", subtitle: "" },
  browse: { title: "Browse tools", subtitle: "Everything your neighbors are lending." },
  listings: { title: "My listings", subtitle: "Tools you lend, and whether they're out." },
  requests: { title: "My requests", subtitle: "Things you've asked to borrow." },
  incoming: { title: "Incoming requests", subtitle: "Neighbors asking to borrow your tools." },
  admin: { title: "Admin", subtitle: "Neighbors, every loan, and the audit log." },
};

export default function Dashboard() {
  const me = useQuery(api.users.me);
  // The tab lives in the URL so "back" from a tool page returns to the same view.
  const requested = useSearchParams().get("tab");
  const isAdmin = me?.role === "admin";
  const tab: Tab = TABS.find((t) => t === requested && (t !== "admin" || isAdmin)) ?? "overview";

  if (!me) return <Loading />;

  return (
    <>
      {tab !== "overview" && (
        <div className="mb-6">
          <h1 className="text-3xl">{TITLES[tab].title}</h1>
          <p className="mt-1 text-ink-soft">{TITLES[tab].subtitle}</p>
        </div>
      )}
      {tab === "overview" && <Overview name={me.name} />}
      {tab === "browse" && <BrowseTools isAdmin={isAdmin} />}
      {tab === "listings" && <MyListings />}
      {tab === "requests" && <LoanList view="borrower" />}
      {tab === "incoming" && <LoanList view="owner" />}
      {tab === "admin" && isAdmin && <AdminPanel />}
    </>
  );
}
