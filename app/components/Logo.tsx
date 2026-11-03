/**
 * LendLoop mark: a library-style hang tag whose punch hole is a house.
 * "Out on loan" + "neighborhood" in one filled shape that stays legible at 16px.
 */
export function LogoMark({ className = "h-8 w-8" }: { className?: string }) {
  return (
    <svg viewBox="0 0 64 64" className={className} aria-hidden="true">
      <g transform="rotate(-18 32 34)">
        {/* String: tied at the grommet, trails off the tip and curls once. */}
        <path
          d="M32 20.5 C33 8, 46 1, 55 6.5 C59.5 9, 58.5 14, 54.5 13.2"
          fill="none"
          stroke="var(--color-accent)"
          strokeWidth="3"
          strokeLinecap="round"
        />
        {/* Tag body with a cut corner, a house-shaped grommet ring and a house hole (evenodd). */}
        <path
          fill="var(--color-brand)"
          fillRule="evenodd"
          d="M20 58 H36.4 V46.4 H48 V29 L35 13 Q32 9.5 29 13 L16 29 V54 Q16 58 20 58 Z M32 16.91 L42.6 27.51 V41.6 H21.4 V27.51 Z M32 18.89 L41.2 28.09 V40.2 H22.8 V28.09 Z M32 22 L39 29 V38 H25 V29 Z"
        />
        {/* Folded corner flap. */}
        <path fill="var(--color-brand)" fillOpacity="0.5" d="M38 48 H47 L38 57 Z" />
      </g>
    </svg>
  );
}

export function Logo() {
  return (
    <span className="inline-flex items-center gap-2">
      <LogoMark />
      <span className="font-display text-xl font-bold tracking-tight">LendLoop</span>
    </span>
  );
}
