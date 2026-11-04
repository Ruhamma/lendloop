"use client";

import { useEffect, useRef } from "react";

/**
 * Neighbors-in-windows loop in its natural colors. Muted and decorative; paused for people
 * who prefer reduced motion.
 */
export function NeighborsVideo({
  className = "",
  fit = "cover",
}: {
  className?: string;
  /** "contain" shows the whole frame (letterboxed on the wall color) instead of cropping. */
  fit?: "cover" | "contain";
}) {
  const ref = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) ref.current?.pause();
  }, []);

  return (
    <span className={`relative overflow-hidden bg-[#dfd3c4] ${className}`}>
      <video
        ref={ref}
        className={`block h-full w-full ${fit === "contain" ? "object-contain" : "object-cover"}`}
        src="/media/neighbors.mp4"
        poster="/media/neighbors-poster.jpg"
        autoPlay
        muted
        loop
        playsInline
        preload="metadata"
        aria-hidden
      />
    </span>
  );
}
