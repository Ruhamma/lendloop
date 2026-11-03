import { Show, SignInButton } from "@clerk/nextjs";
import { CalendarDays, Handshake, MapPin, PackagePlus, ShieldCheck, Star } from "lucide-react";
import Link from "next/link";
import { Suspense } from "react";
import { Logo, LogoMark } from "./components/Logo";
import { PublicToolList } from "./PublicToolList";

const STEPS = [
  {
    icon: PackagePlus,
    title: "List what you rarely use",
    text: "The drill you use twice a year, the tent from last summer. Add a photo and your neighborhood.",
  },
  {
    icon: CalendarDays,
    title: "Request the dates you need",
    text: "See when a tool is free, pick your dates and add a note so the owner knows what it's for.",
  },
  {
    icon: Handshake,
    title: "Hand over, return, rate",
    text: "Meet up, get a reminder if it's late, and rate each other after. Trust builds one loan at a time.",
  },
];

const PROMISES = [
  {
    icon: MapPin,
    title: "Your address stays private",
    text: "Neighbors only see your area. Pickup details go to one approved borrower and are deleted after.",
  },
  {
    icon: ShieldCheck,
    title: "Photos without your location",
    text: "We strip the hidden GPS data phones put in pictures before they're uploaded.",
  },
  {
    icon: Star,
    title: "Ratings from real loans",
    text: "Only people who actually lent or borrowed can rate, and only once the tool is back.",
  },
];

export default function Home() {
  return (
    <div className="flex min-h-full flex-col">
      <header className="mx-auto flex w-full max-w-6xl items-center justify-between px-4 py-5 sm:px-6">
        <Logo />
        <Suspense fallback={null}>
          <AuthAction compact />
        </Suspense>
      </header>

      <main className="flex-1">
        <section className="mx-auto grid w-full max-w-6xl items-center gap-12 px-4 pb-16 pt-8 sm:px-6 md:grid-cols-[1.1fr_0.9fr] md:pt-16">
          <div>
            <p className="inline-flex items-center gap-2 rounded-full bg-accent-soft px-3 py-1 text-sm font-semibold text-ink">
              <span className="h-2 w-2 rounded-full bg-accent" aria-hidden /> Your neighborhood tool
              shelf
            </p>
            <h1 className="mt-5 text-5xl font-extrabold leading-[1.05] tracking-tight sm:text-6xl">
              Borrow what you need. <span className="text-brand">Lend what you don&apos;t.</span>
            </h1>
            <p className="mt-5 max-w-xl text-lg text-muted">
              Most tools sit unused most of the year. LendLoop lets neighbors share them, with
              dates, reminders and ratings handled for you.
            </p>
            <div className="mt-8 h-12">
              {/* Auth state is request-time data, so it streams in behind Suspense
                  while the rest of the page is served from the static shell. */}
              <Suspense fallback={null}>
                <AuthAction />
              </Suspense>
            </div>
          </div>

          <HeroArt />
        </section>

        <section className="border-y border-line bg-surface">
          <div className="mx-auto w-full max-w-6xl px-4 py-16 sm:px-6">
            <h2 className="text-3xl font-bold">How it works</h2>
            <ol className="mt-8 grid gap-6 md:grid-cols-3">
              {STEPS.map((step, i) => (
                <li key={step.title} className="rounded-card border border-line bg-paper p-6">
                  <div className="flex items-center gap-3">
                    <span className="flex h-10 w-10 items-center justify-center rounded-full bg-brand text-white">
                      <step.icon className="h-5 w-5" aria-hidden />
                    </span>
                    <span className="font-display text-sm font-bold text-muted">Step {i + 1}</span>
                  </div>
                  <h3 className="mt-4 text-lg font-bold">{step.title}</h3>
                  <p className="mt-2 text-muted">{step.text}</p>
                </li>
              ))}
            </ol>
          </div>
        </section>

        <section className="mx-auto w-full max-w-6xl px-4 py-16 sm:px-6">
          <h2 className="text-3xl font-bold">Available now</h2>
          <p className="mt-1 text-muted">Sign in to see details and request a tool.</p>
          <div className="mt-8">
            <PublicToolList />
          </div>
        </section>

        <section className="mx-auto w-full max-w-6xl px-4 pb-20 sm:px-6">
          <div className="rounded-card bg-ink px-6 py-12 text-white sm:px-10">
            <h2 className="text-3xl font-bold">Built for trust between neighbors</h2>
            <ul className="mt-8 grid gap-8 md:grid-cols-3">
              {PROMISES.map((p) => (
                <li key={p.title}>
                  <p.icon className="h-6 w-6 text-accent" aria-hidden />
                  <h3 className="mt-3 text-lg font-bold">{p.title}</h3>
                  <p className="mt-2 text-white/75">{p.text}</p>
                </li>
              ))}
            </ul>
          </div>
        </section>
      </main>

      <footer className="border-t border-line">
        <div className="mx-auto flex w-full max-w-6xl items-center justify-between px-4 py-6 text-sm text-muted sm:px-6">
          <span className="inline-flex items-center gap-2">
            <LogoMark className="h-5 w-5" /> LendLoop
          </span>
          <span>A take-home project · fictional company</span>
        </div>
      </footer>
    </div>
  );
}

const solid = "bg-brand text-white shadow-lift hover:bg-brand-hover";
const outline = "border border-line bg-surface hover:bg-paper";

function AuthAction({ compact = false }: { compact?: boolean }) {
  const cls = `inline-block rounded-full font-semibold ${compact ? `px-4 py-2 text-sm ${outline}` : `px-6 py-3 text-base ${solid}`}`;
  return (
    <>
      <Show when="signed-out">
        <SignInButton mode="modal" forceRedirectUrl="/dashboard">
          <button className={cls}>{compact ? "Sign in" : "Sign in to lend or borrow"}</button>
        </SignInButton>
      </Show>
      <Show when="signed-in">
        <Link href="/dashboard" className={cls}>
          {compact ? "Dashboard" : "Go to your dashboard"}
        </Link>
      </Show>
    </>
  );
}

/** Decorative stack of loan cards echoing the logo's tag. Hidden from screen readers. */
function HeroArt() {
  return (
    <div className="relative mx-auto h-80 w-full max-w-sm" aria-hidden>
      <div className="absolute inset-6 rotate-6 rounded-[2rem] bg-accent" />
      <div className="absolute inset-6 -rotate-3 rounded-[2rem] bg-brand" />
      <div className="absolute inset-6 flex flex-col justify-between rounded-[2rem] bg-surface p-6 shadow-lift">
        <div className="flex items-center justify-between">
          <span className="rounded-full bg-ok-soft px-2.5 py-0.5 text-xs font-semibold text-ok">
            Available
          </span>
          <LogoMark className="h-9 w-9" />
        </div>
        <div>
          <p className="font-display text-2xl font-bold">Cordless drill</p>
          <p className="mt-1 text-sm text-muted">📍 Bole · Power tools · good</p>
        </div>
        <div className="flex items-center justify-between rounded-2xl bg-paper px-4 py-3">
          <div>
            <p className="text-xs text-muted">Requested</p>
            <p className="text-sm font-semibold">Sat → Mon</p>
          </div>
          <span className="rounded-full bg-brand px-3 py-1 text-xs font-semibold text-white">
            Approved
          </span>
        </div>
      </div>
    </div>
  );
}
