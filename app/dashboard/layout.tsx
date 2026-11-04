import { auth } from "@clerk/nextjs/server";
import { Suspense, type ReactNode } from "react";
import { DashboardShell } from "./DashboardShell";
import { UserGate } from "./UserGate";

// The dashboard requires a session (checked per request) and loads its data live from
// Convex, so navigations into it can't be instant; opt out of instant validation.
export const instant = false;

/** Signed-out visitors are sent to sign in. The session is request-time data, so it sits behind Suspense. */
async function RequireSignIn({ children }: { children: ReactNode }) {
  const { isAuthenticated, redirectToSignIn } = await auth();
  if (!isAuthenticated) return redirectToSignIn();
  return children;
}

export default function DashboardLayout({ children }: LayoutProps<"/dashboard">) {
  return (
    <Suspense
      fallback={<p className="w-full px-3 pb-10 pt-3 sm:px-6 lg:px-10 text-muted">Loading…</p>}
    >
      <RequireSignIn>
        <UserGate>
          <DashboardShell>{children}</DashboardShell>
        </UserGate>
      </RequireSignIn>
    </Suspense>
  );
}
