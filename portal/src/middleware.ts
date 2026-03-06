import { auth } from "@/lib/auth";
import { NextResponse } from "next/server";

export default auth((req) => {
  const { pathname } = req.nextUrl;
  const isLoggedIn = !!req.auth;
  const isAdmin = req.auth?.user?.role === "admin";

  // Public routes
  const publicPaths = ["/login", "/register"];
  const isPublic = publicPaths.some((p) => pathname === p || pathname.startsWith(p));

  if (isPublic) {
    if (isLoggedIn) {
      return NextResponse.redirect(new URL("/portal/dashboard", req.url));
    }
    return NextResponse.next();
  }

  // Protected routes - require login
  if (!isLoggedIn) {
    return NextResponse.redirect(new URL("/portal/login", req.url));
  }

  // Admin routes
  if (pathname.startsWith("/admin") && !isAdmin) {
    return NextResponse.redirect(new URL("/portal/dashboard", req.url));
  }

  return NextResponse.next();
});

export const config = {
  matcher: [
    "/dashboard/:path*",
    "/register-family/:path*",
    "/children/:path*",
    "/family/:path*",
    "/admin/:path*",
    "/login",
    "/register",
  ],
};
