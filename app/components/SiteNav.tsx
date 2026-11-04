import { Show, UserButton } from "@clerk/nextjs";
import Link from "next/link";
import { Suspense } from "react";
import { Logo } from "./Logo";
import { SearchBox } from "./SearchBox";

/** Floating navbar: logo, live tool search, and sign in / sign up or the user's avatar. */
export function SiteNav() {
  return (
    <div className="sticky top-3 z-40 px-3 sm:px-6">
      <nav
        aria-label="Main"
        className="mx-auto flex max-w-[1280px] items-center gap-3 rounded-2xl border border-zinc-200/80 bg-white/95 px-3 py-2 shadow-[0_2px_12px_rgb(0_0_0/0.06)] backdrop-blur sm:gap-6 sm:px-4"
      >
        <Link href="/" aria-label="LendLoop home" className="shrink-0">
          <Logo />
        </Link>
        <div className="flex min-w-0 flex-1 justify-center">
          <SearchBox />
        </div>
        {/* Auth state is request-time data, so it streams in behind Suspense. */}
        <Suspense fallback={<div className="h-10 w-40" aria-hidden />}>
          <AuthButtons />
        </Suspense>
      </nav>
    </div>
  );
}

function AuthButtons() {
  return (
    <div className="flex shrink-0 items-center gap-2">
      <Show when="signed-out">
        <Link
          href="/sign-in"
          className="hidden rounded-xl bg-zinc-100 px-4 py-2 text-sm font-medium text-zinc-800 hover:bg-zinc-200 sm:inline-block"
        >
          Log in
        </Link>
        <Link
          href="/sign-up"
          className="rounded-xl bg-zinc-950 px-4 py-2 text-sm font-medium text-white hover:bg-zinc-800"
        >
          Sign up
        </Link>
      </Show>
      <Show when="signed-in">
        <Link
          href="/dashboard"
          className="hidden rounded-xl bg-zinc-100 px-4 py-2 text-sm font-medium text-zinc-800 hover:bg-zinc-200 sm:inline-block"
        >
          Dashboard
        </Link>
        <UserButton />
      </Show>
    </div>
  );
}
