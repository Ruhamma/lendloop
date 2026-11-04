import type { ReactNode } from "react";

/** Shared page width: wide enough to breathe, contained enough to read. */
export function Container({
  children,
  className = "",
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <div className={`mx-auto w-full max-w-[1280px] px-4 sm:px-6 ${className}`}>{children}</div>
  );
}
