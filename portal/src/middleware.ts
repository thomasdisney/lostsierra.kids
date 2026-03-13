import { auth } from "@/lib/auth";
import { NextResponse } from "next/server";

export default auth((req) => {
  const { pathname } = req.nextUrl;
  const isLoggedIn = !!req.auth;
  const userRole = (req.auth?.user as { role?: string })?.role;
  const isAdmin = userRole === "admin";
  const isNewUser = userRole === "new_user";
  const isNewAccount = userRole === "new_account";

  // Public routes
  const publicPaths = ["/login", "/register", "/verify"];
  const isPublic = publicPaths.some(
    (p) => pathname === p || pathname.startsWith(p)
  );

  if (isPublic) {
    if (isLoggedIn && pathname !== "/verify") {
      return NextResponse.redirect(new URL("/portal/dashboard", req.url));
    }
    return NextResponse.next();
  }

  // Protected routes - require login
  if (!isLoggedIn) {
    return NextResponse.redirect(new URL("/portal/login", req.url));
  }

  // Redirect unverified users to verify page
  const isEmailVerified = (req.auth?.user as { isEmailVerified?: boolean })
    ?.isEmailVerified;
  if (!isEmailVerified) {
    const email = req.auth?.user?.email || "";
    return NextResponse.redirect(
      new URL(
        `/portal/verify?email=${encodeURIComponent(email)}`,
        req.url
      )
    );
  }

  // new_user restriction: only dashboard + register-family allowed
  if (isNewUser) {
    const allowedPaths = ["/dashboard", "/register-family"];
    const isAllowed = allowedPaths.some(
      (p) => pathname === p || pathname.startsWith(p + "/")
    );
    if (!isAllowed) {
      return NextResponse.redirect(new URL("/portal/dashboard", req.url));
    }
  }

  // new_account restriction: dashboard, register-family, children, family, announcements
  if (isNewAccount) {
    const allowedPaths = ["/dashboard", "/register-family", "/children", "/family", "/announcements"];
    const isAllowed = allowedPaths.some(
      (p) => pathname === p || pathname.startsWith(p + "/")
    );
    if (!isAllowed) {
      return NextResponse.redirect(new URL("/portal/dashboard", req.url));
    }
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
    "/announcements/:path*",
    "/attendance/:path*",
    "/reports/:path*",
    "/billing/:path*",
    "/login",
    "/register",
    "/verify",
  ],
};
