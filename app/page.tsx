import { Show } from "@clerk/nextjs";
import { ArrowDown, MapPin, ShieldCheck, Star } from "lucide-react";
import Link from "next/link";
import { Suspense } from "react";
import { Container } from "./components/Container";
import { SiteFooter } from "./components/SiteFooter";
import { SiteNav } from "./components/SiteNav";
import { NeighborsVideo } from "./NeighborsVideo";
import { Splash, SplashGate } from "./Splash";
import { ToolShowcase } from "./ToolShowcase";

const PROMISES = [
  { icon: MapPin, label: "Private pickup" },
  { icon: ShieldCheck, label: "No GPS in photos" },
  { icon: Star, label: "Ratings from real loans" },
];

const rise = (i: number) => ({ "--i": i }) as React.CSSProperties;

export default function Home() {
  return (
    <div className="flex min-h-full flex-col">
      <SplashGate />
      <Splash />

      {/* Hero: white fading into a soft cream, giant serif headline with the neighbors video
          set into the type. The only cream on the site lives here. */}
      <div className="bg-gradient-to-b from-white via-white to-cream pt-3">
        <SiteNav />
        <section className="flex flex-col items-center px-4 pb-12 pt-14 text-center sm:px-6 md:pt-20">
          <h1 className="text-[clamp(3rem,9.5vw,9rem)] leading-[0.92] tracking-tight">
            <span className="rise-in flex items-center justify-center gap-[0.16em]">
              Borrow
              <NeighborsVideo className="inline-block h-[0.84em] w-[2.1em] rounded-full align-middle" />
            </span>{" "}
            <span className="rise-in block" style={rise(2)}>
              what you need.
            </span>
          </h1>
          <p
            className="rise-in mt-6 font-display text-[clamp(1.6rem,3.4vw,3rem)] text-brand"
            style={rise(4)}
          >
            Lend what you don&apos;t.
          </p>
          <p className="rise-in mt-5 max-w-2xl text-lg text-ink-soft sm:text-xl" style={rise(5)}>
            Someone two doors down owns the drill you need this weekend. LendLoop makes the asking
            easy, with dates, reminders and ratings handled for you.
          </p>
          <div
            className="rise-in mt-9 flex flex-wrap items-center justify-center gap-4"
            style={rise(6)}
          >
            <Suspense fallback={<div className="h-14 w-64" aria-hidden />}>
              <PrimaryAction />
            </Suspense>
            <a
              href="#available"
              className="group inline-flex items-center gap-3 text-sm font-semibold uppercase tracking-wide"
            >
              Browse tools
              <span className="flex h-12 w-12 items-center justify-center rounded-full border border-black/10 bg-white transition-transform group-hover:translate-y-0.5">
                <ArrowDown className="h-4 w-4" aria-hidden />
              </span>
            </a>
          </div>
        </section>

        <Container>
          <ul className="flex flex-wrap items-center justify-center gap-x-12 gap-y-3 border-t border-black/10 py-5 text-sm font-semibold uppercase tracking-wide text-ink-soft md:justify-between">
            {PROMISES.map((p) => (
              <li key={p.label} className="inline-flex items-center gap-3">
                <span className="flex h-10 w-10 items-center justify-center rounded-full bg-white text-accent ring-1 ring-black/5">
                  <p.icon className="h-4 w-4" aria-hidden />
                </span>
                {p.label}
              </li>
            ))}
          </ul>
        </Container>
      </div>

      <main className="flex-1">
        <section id="available" className="scroll-mt-24 py-16">
          <Container>
            <div className="mb-10 text-center">
              <h2 className="text-[clamp(2rem,4vw,3rem)] leading-tight">
                Available now on your street
              </h2>
              <p className="mt-2 text-ink-soft">Sign in to see details and request a tool.</p>
            </div>
            <ToolShowcase />
            <div className="mt-6 flex justify-center">
              <Link
                href="/dashboard"
                className="rounded-full border border-line bg-surface px-6 py-3 text-sm font-medium hover:bg-paper"
              >
                See all tools
              </Link>
            </div>
          </Container>
        </section>
      </main>

      <SiteFooter />
    </div>
  );
}

function PrimaryAction() {
  const cls =
    "inline-block rounded-full bg-brand px-8 py-4 text-base font-semibold text-white shadow-lift transition-colors hover:bg-brand-hover";
  return (
    <>
      <Show when="signed-out">
        <Link href="/sign-in" className={cls}>
          Sign in to lend or borrow
        </Link>
      </Show>
      <Show when="signed-in">
        <Link href="/dashboard" className={cls}>
          Go to your dashboard
        </Link>
      </Show>
    </>
  );
}
