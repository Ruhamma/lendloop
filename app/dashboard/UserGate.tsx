"use client";

import { useConvexAuth, useMutation } from "convex/react";
import { useEffect, useState, type ReactNode } from "react";
import { api } from "@/convex/_generated/api";

/**
 * Make sure the signed-in Clerk user has a row in Convex before any page queries need it.
 * Children only render while Convex is authenticated, so signing out unmounts the dashboard
 * (and its live queries) before the redirect instead of letting them fail with "Not signed in".
 */
export function UserGate({ children }: { children: ReactNode }) {
  const { isAuthenticated } = useConvexAuth();
  const store = useMutation(api.users.store);
  const [stored, setStored] = useState(false);
  useEffect(() => {
    if (!isAuthenticated) return;
    store().then(() => setStored(true));
  }, [isAuthenticated, store]);

  if (!isAuthenticated || !stored) {
    return <p className="w-full px-3 py-6 text-muted sm:px-6 lg:px-10">Loading…</p>;
  }
  return children;
}
