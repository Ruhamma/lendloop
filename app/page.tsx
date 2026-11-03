import { Show, SignInButton } from "@clerk/nextjs";
import Link from "next/link";
import { Suspense } from "react";
import { PublicToolList } from "./PublicToolList";

export default function Home() {
  return (
    <main className="mx-auto w-full max-w-3xl px-4 py-16">
      <header className="mb-12">
        <p className="text-sm font-medium uppercase tracking-widest text-emerald-700">LendLoop</p>
        <h1 className="mt-3 text-4xl font-semibold tracking-tight sm:text-5xl">
          Borrow what you need. Lend what you don&apos;t.
        </h1>
        <p className="mt-4 max-w-xl text-lg text-stone-600">
          A tool-lending board for your neighborhood. List the drill you use twice a year, borrow
          the ladder you need once.
        </p>
        <div className="mt-8 h-12">
          {/* Auth state is request-time data, so it streams in behind Suspense
              while the rest of the page is served from the static shell. */}
          <Suspense fallback={null}>
            <AuthAction />
          </Suspense>
        </div>
      </header>

      <section>
        <h2 className="mb-4 text-sm font-medium uppercase tracking-widest text-stone-500">
          Available now
        </h2>
        <PublicToolList />
      </section>
    </main>
  );
}

function AuthAction() {
  return (
    <>
      <Show when="signed-out">
        <SignInButton mode="modal" forceRedirectUrl="/dashboard">
          <button className="rounded-full bg-stone-900 px-6 py-3 text-sm font-medium text-white hover:bg-stone-700">
            Sign in to lend or borrow
          </button>
        </SignInButton>
      </Show>
      <Show when="signed-in">
        <Link
          href="/dashboard"
          className="inline-block rounded-full bg-stone-900 px-6 py-3 text-sm font-medium text-white hover:bg-stone-700"
        >
          Go to your dashboard
        </Link>
      </Show>
    </>
  );
}
