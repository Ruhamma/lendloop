import { clerkMiddleware } from "@clerk/nextjs/server";

const convexUrl = process.env.NEXT_PUBLIC_CONVEX_URL!;
// Convex syncs over a WebSocket on the same host, and serves uploaded photos from it.
const convexSocket = convexUrl.replace(/^http/, "ws");

// Makes the Clerk session available to server code and sets the Content-Security-Policy.
// Clerk merges these directives with the ones its own scripts, frames and API need.
// Route protection lives in app/dashboard/layout.tsx; data access checks live in Convex.
export default clerkMiddleware({
  contentSecurityPolicy: {
    directives: {
      "connect-src": [convexUrl, convexSocket],
      // blob: and data: cover local previews of a photo before it is uploaded.
      "img-src": [convexUrl, "https://img.clerk.com", "blob:", "data:"],
      "frame-ancestors": ["'none'"],
      "object-src": ["'none'"],
      "base-uri": ["'self'"],
      "form-action": ["'self'"],
    },
  },
});

export const config = {
  matcher: [
    // Skip Next.js internals and static files.
    "/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)",
    "/(api|trpc)(.*)",
  ],
};
