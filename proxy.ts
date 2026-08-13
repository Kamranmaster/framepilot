import { clerkMiddleware } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";

const publicRoutes = ["/sign-in", "/sign-up", "/", "/home"] as const;

const isPublicRoute = (pathname: string) =>
  publicRoutes.some((route) => pathname === route || pathname.startsWith(`${route}/`));

const isPublicApiRoute = (pathname: string) => pathname.startsWith("/api/videos");

export default clerkMiddleware(async (auth, req) => {
  const { userId } = await auth();
  const currentUrl = req.nextUrl.pathname;

  if (!userId && !isPublicRoute(currentUrl) && !isPublicApiRoute(currentUrl)) {
    return NextResponse.redirect(new URL("/sign-in", req.url));
  }

  return NextResponse.next();
});

export const config = {
  matcher: [
    "/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)",
    "/(api|trpc)(.*)",
    "/__clerk/(.*)",
  ],
};