import { BadgeCheck, MapPin } from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { Suspense, type ReactNode } from "react";
import { NeighborsVideo } from "../NeighborsVideo";
import { Logo } from "./Logo";

const NOTCH_W = "7rem";
const NOTCH_H = "3.5rem";
const R = "1.5rem";

/**
 * A rounded panel with notches cut into the top-left and bottom-right corners. Each notch
 * is a white block with a rounded inner corner, plus two small "fillets" (radial gradients)
 * that round the panel's corners where the notch meets its edges. White = page background.
 */
function NotchedPanel({ children }: { children: ReactNode }) {
  const fillet = (at: string) => ({
    width: R,
    height: R,
    background: `radial-gradient(circle at ${at}, transparent calc(${R} - 0.5px), white ${R})`,
  });
  return (
    <div className="relative h-full overflow-hidden rounded-[2rem]">
      {children}
      <div className="pointer-events-none absolute inset-0 hidden lg:block" aria-hidden>
        <span
          className="absolute left-0 top-0 bg-white"
          style={{ width: NOTCH_W, height: NOTCH_H, borderBottomRightRadius: R }}
        />
        <span className="absolute top-0" style={{ left: NOTCH_W, ...fillet("100% 100%") }} />
        <span className="absolute left-0" style={{ top: NOTCH_H, ...fillet("100% 100%") }} />
        <span
          className="absolute bottom-0 right-0 bg-white"
          style={{ width: NOTCH_W, height: NOTCH_H, borderTopLeftRadius: R }}
        />
        <span className="absolute bottom-0" style={{ right: NOTCH_W, ...fillet("0% 0%") }} />
        <span className="absolute right-0" style={{ bottom: NOTCH_H, ...fillet("0% 0%") }} />
      </div>
    </div>
  );
}

/**
 * Full-width two-column auth layout: form on the left, the neighbors video in a notched
 * panel on the right. On phones the video becomes a slim banner above the form.
 */
export function AuthShell({
  title,
  subtitle,
  children,
}: {
  title: string;
  subtitle: string;
  children: ReactNode;
}) {
  return (
    <div className="grid min-h-screen bg-white lg:grid-cols-2">
      <div className="flex flex-col px-6 py-6 sm:px-12">
        <Link href="/" aria-label="LendLoop home" className="self-start">
          <Logo />
        </Link>
        <div className="mx-auto flex w-full max-w-sm flex-1 flex-col justify-center py-10">
          <Image
            src="/mascot/pip-waving.png"
            alt="Pip the LendLoop dog waving"
            width={96}
            height={104}
            className="mx-auto"
            priority
          />
          <h1 className="mt-3 text-center text-4xl leading-tight">{title}</h1>
          <p className="mt-2 text-center text-ink-soft">{subtitle}</p>
          <div className="mt-8">
            {/* Clerk's form reads the URL, which is request-time data under Cache Components. */}
            <Suspense fallback={<div className="h-80 animate-pulse rounded-2xl bg-paper" />}>
              {children}
            </Suspense>
          </div>
        </div>
      </div>

      <div className="order-first h-44 p-3 lg:order-none lg:h-auto">
        <NotchedPanel>
          {/* The panel takes the video's own wall color, so the whole frame shows uncropped. */}
          <div className="flex h-full flex-col bg-[#dfd3c4]">
            <div className="relative min-h-0 flex-1">
              <NeighborsVideo fit="contain" className="absolute inset-0 block h-full w-full" />
            </div>
            <div className="hidden px-10 pb-20 pt-4 text-center text-ink lg:block">
              <p className="font-display text-4xl leading-tight">
                Your street already has a toolbox
              </p>
              <p className="mx-auto mt-3 max-w-md text-ink-soft">
                Borrow the ladder for a weekend, lend the drill you use twice a year, and get to
                know the people next door.
              </p>
              <div className="mt-6 flex flex-wrap justify-center gap-3">
                <span className="inline-flex items-center gap-2 rounded-full border border-ink/25 bg-white/60 px-4 py-2 text-sm font-medium">
                  <MapPin className="h-4 w-4" aria-hidden /> Private pickup
                </span>
                <span className="inline-flex items-center gap-2 rounded-full border border-ink/25 bg-white/60 px-4 py-2 text-sm font-medium">
                  <BadgeCheck className="h-4 w-4" aria-hidden /> Trusted neighbors
                </span>
              </div>
            </div>
          </div>
        </NotchedPanel>
      </div>
    </div>
  );
}

/**
 * Restyles Clerk's form to match: no card chrome (the page is the card), pill inputs and
 * buttons, a black primary button. Our own heading replaces Clerk's. Works because Clerk's
 * CSS sits in the "clerk" layer, below Tailwind utilities (globals.css, layout.tsx).
 */
export const authFormAppearance = {
  elements: {
    rootBox: "w-full",
    // overflow-visible + a little top padding so the "Last used" badge above the Google
    // button isn't clipped.
    cardBox: "w-full shadow-none border-0 rounded-none overflow-visible",
    card: "w-full shadow-none border-0 bg-transparent p-0 pt-3 gap-5 overflow-visible",
    main: "overflow-visible",
    socialButtons: "overflow-visible",
    header: "hidden",
    socialButtonsBlockButton:
      "rounded-full border border-line bg-white py-2.5 text-ink hover:bg-paper shadow-none",
    dividerLine: "bg-line",
    dividerText: "text-muted",
    formFieldLabel: "text-sm font-medium text-ink",
    formFieldInput:
      "rounded-full border border-line bg-white px-4 py-2.5 shadow-none focus:border-zinc-400 focus:ring-4 focus:ring-zinc-900/5",
    formButtonPrimary:
      "rounded-full bg-zinc-950 py-3 text-sm font-medium normal-case shadow-none hover:bg-zinc-800",
    footer: "bg-transparent border-0 shadow-none",
    footerAction: "justify-center",
    footerActionLink: "font-semibold text-ink underline-offset-4 hover:underline",
  },
};
