"use client";

import { useConvexAuth, useMutation } from "convex/react";
import { useEffect, useState, type ReactNode } from "react";
import { api } from "@/convex/_generated/api";

/** Make sure the signed-in Clerk user has a row in Convex before any page queries need it. */
export function UserGate({ children }: { children: ReactNode }) {
  const { isAuthenticated } = useConvexAuth();
  const store = useMutation(api.users.store);
  const [stored, setStored] = useState(false);
  useEffect(() => {
    if (!isAuthenticated) return;
    store().then(() => setStored(true));
  }, [isAuthenticated, store]);

  if (!stored) return <p className="mx-auto w-full max-w-4xl px-4 py-8 text-stone-500">Loading…</p>;
  return children;
}
