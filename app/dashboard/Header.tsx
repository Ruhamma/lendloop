"use client";

import { UserButton } from "@clerk/nextjs";
import { useQuery } from "convex/react";
import Link from "next/link";
import { api } from "@/convex/_generated/api";
import { Stars } from "./ui";

export function Header() {
  const me = useQuery(api.users.me);
  return (
    <header className="mb-8 flex items-center justify-between">
      <Link href="/dashboard" className="text-lg font-semibold">
        LendLoop
      </Link>
      <div className="flex items-center gap-3">
        {me?.rating && <Stars value={me.rating.average} count={me.rating.count} />}
        {me?.trustedLender && <span className="text-xs text-emerald-700">★ Trusted Lender</span>}
        {me?.role === "admin" && <span className="text-xs text-stone-500">Admin</span>}
        <UserButton />
      </div>
    </header>
  );
}
