import { auth } from "@clerk/nextjs/server";
import { Suspense, type ReactNode } from "react";
import { Header } from "./Header";
import { UserGate } from "./UserGate";

/** Signed-out visitors are sent to sign in. The session is request-time data, so it sits behind Suspense. */
async function RequireSignIn({ children }: { children: ReactNode }) {
  const { isAuthenticated, redirectToSignIn } = await auth();
  if (!isAuthenticated) return redirectToSignIn();
  return children;
}

export default function DashboardLayout({ children }: LayoutProps<"/dashboard">) {
  return (
    <Suspense
      fallback={<p className="mx-auto w-full max-w-6xl px-4 py-6 sm:px-6 text-muted">Loading…</p>}
    >
      <RequireSignIn>
        <UserGate>
          <div className="mx-auto w-full max-w-6xl px-4 py-6 sm:px-6">
            <Header />
            {children}
          </div>
        </UserGate>
      </RequireSignIn>
    </Suspense>
  );
}
