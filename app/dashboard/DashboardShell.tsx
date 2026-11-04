"use client";

import { UserButton } from "@clerk/nextjs";
import { useQuery } from "convex/react";
import {
  Inbox,
  LayoutDashboard,
  LayoutGrid,
  Menu,
  Package,
  Send,
  ShieldCheck,
  X,
} from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { useState, type ReactNode } from "react";
import { api } from "@/convex/_generated/api";
import { Logo } from "../components/Logo";
import { SearchBox } from "../components/SearchBox";
import { Stars } from "./ui";

export const TABS = ["overview", "browse", "listings", "requests", "incoming", "admin"] as const;
export type Tab = (typeof TABS)[number];

/**
 * App frame in the style of an analytics dashboard: a left sidebar with live counts, a top
 * bar with search and the account menu, and a contained content area.
 */
export function DashboardShell({ children }: { children: ReactNode }) {
  const me = useQuery(api.users.me);
  const mine = useQuery(api.tools.mine);
  const incoming = useQuery(api.loans.incoming);
  const requests = useQuery(api.loans.myRequests);
  const [menuOpen, setMenuOpen] = useState(false);

  const pendingIncoming = incoming?.filter((l) => l.status === "pending").length ?? 0;
  const activeRequests =
    requests?.filter((l) => l.status === "pending" || l.status === "approved").length ?? 0;

  const nav: { tab: Tab; label: string; icon: typeof LayoutGrid; count?: number }[] = [
    { tab: "overview", label: "Overview", icon: LayoutDashboard },
    { tab: "browse", label: "Browse tools", icon: LayoutGrid },
    { tab: "listings", label: "My listings", icon: Package, count: mine?.length },
    { tab: "requests", label: "My requests", icon: Send, count: activeRequests || undefined },
    { tab: "incoming", label: "Incoming", icon: Inbox, count: pendingIncoming || undefined },
    ...(me?.role === "admin" ? [{ tab: "admin" as const, label: "Admin", icon: ShieldCheck }] : []),
  ];

  const sidebar = (
    <div className="flex h-full flex-col">
      <div className="flex items-center justify-between px-5 pb-6 pt-5">
        {/* The logo always goes to the landing page. */}
        <Link href="/" aria-label="LendLoop home">
          <Logo />
        </Link>
        <button
          type="button"
          aria-label="Close menu"
          className="rounded-lg p-1.5 text-muted hover:bg-paper lg:hidden"
          onClick={() => setMenuOpen(false)}
        >
          <X className="h-5 w-5" />
        </button>
      </div>
      <p className="px-5 pb-2 text-xs font-semibold uppercase tracking-wide text-muted">Menu</p>
      <nav aria-label="Dashboard" className="flex-1 space-y-1 px-3">
        {nav.map((item) => (
          <NavItem key={item.tab} {...item} onNavigate={() => setMenuOpen(false)} />
        ))}
      </nav>

      <div className="m-3 rounded-2xl bg-zinc-950 p-4 text-white">
        <Image src="/mascot/pip-toolbox.png" alt="" width={84} height={78} className="-mt-1 mb-1" />
        <p className="font-semibold">Got something in your shed?</p>
        <p className="mt-1 text-xs text-white/70">
          A ladder or a drill could make a neighbor&apos;s week.
        </p>
        <Link
          href="/dashboard?tab=listings"
          onClick={() => setMenuOpen(false)}
          className="mt-3 block rounded-xl bg-white py-2 text-center text-sm font-medium text-zinc-950 hover:bg-zinc-200"
        >
          List a tool
        </Link>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-paper lg:grid lg:grid-cols-[256px_1fr]">
      <aside className="sticky top-0 hidden h-screen border-r border-line bg-white lg:block">
        {sidebar}
      </aside>

      {menuOpen && (
        <div className="fixed inset-0 z-50 lg:hidden">
          <button
            type="button"
            aria-label="Close menu"
            className="absolute inset-0 bg-ink/40"
            onClick={() => setMenuOpen(false)}
          />
          <aside className="relative h-full w-72 bg-white shadow-lift">{sidebar}</aside>
        </div>
      )}

      <div className="min-w-0">
        <header className="sticky top-0 z-30 flex items-center gap-3 border-b border-line bg-white/90 px-4 py-3 backdrop-blur sm:px-6">
          <button
            type="button"
            aria-label="Open menu"
            className="rounded-lg p-2 text-ink hover:bg-paper lg:hidden"
            onClick={() => setMenuOpen(true)}
          >
            <Menu className="h-5 w-5" />
          </button>
          <div className="flex min-w-0 flex-1">
            <SearchBox />
          </div>
          <div className="flex shrink-0 items-center gap-3">
            {me?.rating && <Stars value={me.rating.average} count={me.rating.count} />}
            {me?.role === "admin" && (
              <span className="hidden items-center gap-1 rounded-full bg-brand-soft px-2.5 py-1 text-xs font-semibold text-brand sm:inline-flex">
                <ShieldCheck className="h-3.5 w-3.5" aria-hidden /> Admin
              </span>
            )}
            <UserButton />
          </div>
        </header>

        <main className="mx-auto w-full max-w-[1200px] px-4 py-8 sm:px-6">{children}</main>
      </div>
    </div>
  );
}

function NavItem({
  tab,
  label,
  icon: Icon,
  count,
  onNavigate,
}: {
  tab: Tab;
  label: string;
  icon: typeof LayoutGrid;
  count?: number;
  onNavigate: () => void;
}) {
  const pathname = usePathname();
  const current = useSearchParams().get("tab") ?? "overview";
  const active = pathname === "/dashboard" && current === tab;
  return (
    <Link
      href={`/dashboard?tab=${tab}`}
      onClick={onNavigate}
      aria-current={active ? "page" : undefined}
      className={`flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-colors ${
        active ? "bg-brand-soft text-brand" : "text-ink-soft hover:bg-paper hover:text-ink"
      }`}
    >
      <Icon className="h-4 w-4" aria-hidden />
      <span className="flex-1">{label}</span>
      {count !== undefined && count > 0 && (
        <span
          className={`rounded-full px-2 py-0.5 text-xs font-semibold ${
            active ? "bg-white text-brand" : "bg-paper text-ink-soft"
          }`}
        >
          {count}
        </span>
      )}
    </Link>
  );
}
