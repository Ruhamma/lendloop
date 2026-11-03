"use client";

import { UserButton } from "@clerk/nextjs";
import { useQuery } from "convex/react";
import { BadgeCheck, ShieldCheck } from "lucide-react";
import Link from "next/link";
import { api } from "@/convex/_generated/api";
import { Logo } from "../components/Logo";
import { Stars } from "./ui";

export function Header() {
  const me = useQuery(api.users.me);
  return (
    <header className="mb-8 flex flex-wrap items-center justify-between gap-4">
      <Link href="/dashboard" aria-label="LendLoop dashboard">
        <Logo />
      </Link>
      <div className="flex items-center gap-3">
        {me?.rating && <Stars value={me.rating.average} count={me.rating.count} />}
        {me?.trustedLender && (
          <span className="inline-flex items-center gap-1 rounded-full bg-accent-soft px-2.5 py-1 text-xs font-semibold">
            <BadgeCheck className="h-3.5 w-3.5 text-brand" aria-hidden /> Trusted Lender
          </span>
        )}
        {me?.role === "admin" && (
          <span className="inline-flex items-center gap-1 rounded-full bg-brand-soft px-2.5 py-1 text-xs font-semibold text-brand">
            <ShieldCheck className="h-3.5 w-3.5" aria-hidden /> Admin
          </span>
        )}
        <UserButton />
      </div>
    </header>
  );
}
