import { Show } from "@clerk/nextjs";
import Link from "next/link";
import { Suspense } from "react";
import Image from "next/image";
import { Container } from "./Container";
import { LogoMark } from "./Logo";

const REPO = "https://github.com/Ruhamma/lendloop";

const COLUMNS = [
  {
    title: "LendLoop",
    links: [
      { label: "Browse tools", href: "/dashboard" },
      { label: "List a tool", href: "/dashboard?tab=listings" },
      { label: "My requests", href: "/dashboard?tab=requests" },
    ],
  },
  {
    title: "Trust & safety",
    links: [
      { label: "How pickup stays private", href: `${REPO}#security-and-data-minimization` },
      { label: "Photo location stripping", href: `${REPO}#security-and-data-minimization` },
      { label: "Production plan", href: `${REPO}/blob/main/PRODUCTION_CONSIDERATIONS.md` },
    ],
  },
  {
    title: "Project",
    links: [
      { label: "Source on GitHub", href: REPO },
      { label: "README", href: `${REPO}#readme` },
    ],
  },
];

/** Closing call to action (a contained card with Pip) and the footer. */
export function SiteFooter() {
  return (
    <footer className="mt-10 pb-6">
      <Container>
        <section className="grid items-center gap-6 overflow-hidden rounded-[2rem] bg-zinc-950 px-8 pt-10 text-white sm:grid-cols-[1fr_auto] sm:px-12 sm:py-0">
          <div className="sm:py-12">
            <h2 className="text-[clamp(1.75rem,3vw,2.5rem)] leading-tight">
              Ready to lend your first tool?
            </h2>
            <p className="mt-3 max-w-md text-white/70">
              It takes a minute to list something you rarely use, and it might make a
              neighbor&apos;s whole weekend.
            </p>
            <div className="mt-7">
              <Suspense fallback={<div className="h-11" aria-hidden />}>
                <Show when="signed-out">
                  <Link
                    href="/sign-up"
                    className="inline-block rounded-full bg-white px-6 py-3 text-sm font-medium text-zinc-950 hover:bg-zinc-200"
                  >
                    Create your free account
                  </Link>
                </Show>
                <Show when="signed-in">
                  <Link
                    href="/dashboard?tab=listings"
                    className="inline-block rounded-full bg-white px-6 py-3 text-sm font-medium text-zinc-950 hover:bg-zinc-200"
                  >
                    List a tool
                  </Link>
                </Show>
              </Suspense>
            </div>
          </div>
          <Image
            src="/mascot/pip-toolbox.png"
            alt="Pip the LendLoop dog carrying a toolbox"
            width={260}
            height={242}
            className="mx-auto self-end sm:mx-0 sm:mt-8"
          />
        </section>

        <div className="mt-4 rounded-[2rem] bg-paper px-6 py-10 ring-1 ring-black/5 sm:px-12">
          <div className="flex flex-wrap items-start justify-between gap-10">
            <div className="max-w-xs">
              <Link href="/" className="inline-flex items-center gap-2">
                <LogoMark className="h-8 w-8" />
                <span className="font-display text-xl">LendLoop</span>
              </Link>
              <p className="mt-3 text-sm text-muted">
                Borrow what you need. Lend what you don&apos;t.
              </p>
            </div>
            <div className="grid grid-cols-2 gap-10 sm:grid-cols-3">
              {COLUMNS.map((col) => (
                <div key={col.title}>
                  <h3 className="font-sans text-sm font-semibold">{col.title}</h3>
                  <ul className="mt-3 space-y-2">
                    {col.links.map((l) => (
                      <li key={l.label}>
                        <Link href={l.href} className="text-sm text-muted hover:text-ink">
                          {l.label}
                        </Link>
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>
          </div>
          <div className="mt-10 flex flex-wrap items-center justify-between gap-3 border-t border-black/10 pt-6 text-xs text-muted">
            <span>© 2026 LendLoop. A fictional company, built as a take-home project.</span>
            <span>Made with care in Addis Ababa</span>
          </div>
        </div>
      </Container>
    </footer>
  );
}
