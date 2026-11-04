"use client";

import { useState } from "react";
import Image from "next/image";
import { LogoMark } from "./components/Logo";

const SEEN_KEY = "ll-splash-seen";

function remember() {
  try {
    sessionStorage.setItem(SEEN_KEY, "1");
  } catch {
    // Private mode or blocked storage: the splash simply shows again next visit.
  }
}

/**
 * First-visit intro: the tag swings, the name reveals, the tagline rises, then the curtain
 * lifts (~3.4 s).
 * Tap or press any key to skip. Hidden before first paint for repeat visits and for
 * reduced motion by the inline script in SplashGate, so it never flashes.
 */
export function Splash() {
  const [done, setDone] = useState(false);
  if (done) return null;

  const finish = () => {
    remember();
    setDone(true);
  };

  return (
    <div
      className="splash fixed inset-0 z-50 flex items-center justify-center bg-paper"
      aria-hidden
      onClick={finish}
      onKeyDown={finish}
      onAnimationEnd={(e) => {
        if (e.animationName === "splash-out") finish();
      }}
    >
      <div className="flex flex-col items-center gap-4">
        <Image
          src="/mascot/pip-waving.png"
          alt=""
          width={130}
          height={141}
          className="splash-pip"
          priority
        />
        <div className="flex items-center gap-4">
          <LogoMark className="h-20 w-20" />
          <span className="splash-word font-display text-5xl text-ink">LendLoop</span>
        </div>
        <p className="splash-tagline text-lg text-muted">
          Borrow what you need. Lend what you don&apos;t.
        </p>
      </div>
    </div>
  );
}

/** Runs during HTML parsing, before paint, so returning visitors never see the splash. */
export function SplashGate() {
  return (
    <script
      dangerouslySetInnerHTML={{
        __html: `try{if(sessionStorage.getItem("${SEEN_KEY}"))document.documentElement.classList.add("no-splash")}catch(e){}`,
      }}
    />
  );
}
