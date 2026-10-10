import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

// Portal route configurations
const PORTAL_CONFIG = {
  staff: {
    basePath: "/portal",
    loginPath: "/portal/login",
    dashboardPath: "/portal/dashboard",
    publicPaths: ["/portal/login", "/portal/forgot-password", "/portal/setup"],
  },
  organization: {
    basePath: "/org",
    loginPath: "/org/login",
    dashboardPath: "/org/dashboard",
    publicPaths: ["/org/login"],
  },
  participant: {
    basePath: "/app",
    loginPath: "/app/login",
    dashboardPath: "/app/dashboard",
    publicPaths: ["/app/login"],
  },
  mentor: {
    basePath: "/mentor",
    loginPath: "/mentor/login",
    dashboardPath: "/mentor/dashboard",
    publicPaths: ["/mentor/login"],
  },
} as const;

type PortalKey = keyof typeof PORTAL_CONFIG;

function getPortalFromPath(pathname: string): PortalKey | null {
  if (pathname.startsWith("/portal")) return "staff";
  if (pathname.startsWith("/org")) return "organization";
  if (pathname.startsWith("/app")) return "participant";
  if (pathname.startsWith("/mentor")) return "mentor";
  return null;
}

function isPublicPath(pathname: string, portal: PortalKey): boolean {
  const config = PORTAL_CONFIG[portal];
  return config.publicPaths.some(
    (path) => pathname === path || pathname.startsWith(`${path}/`)
  );
}

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Skip middleware for static files and API routes
  if (
    pathname.startsWith("/_next") ||
    pathname.startsWith("/api") ||
    pathname.includes(".") ||
    pathname === "/"
  ) {
    return NextResponse.next();
  }

  // Determine which portal this request is for
  const portal = getPortalFromPath(pathname);
  if (!portal) {
    return NextResponse.next();
  }

  const config = PORTAL_CONFIG[portal];

  // Check if this is a public path (login pages, etc.)
  if (isPublicPath(pathname, portal)) {
    // If user has an auth token and is on a login page, redirect to their correct dashboard
    const authToken = request.cookies.get("auth_token")?.value;
    const authPortal = request.cookies.get("auth_portal")?.value as PortalKey | undefined;
    
    if (authToken && pathname === config.loginPath) {
      // Redirect authenticated users to their correct portal's dashboard
      // If they have a stored portal, use that; otherwise use current portal
      const targetPortal = authPortal || portal;
      const targetConfig = PORTAL_CONFIG[targetPortal];
      const dashboardUrl = new URL(targetConfig.dashboardPath, request.url);
      return NextResponse.redirect(dashboardUrl);
    }
    return NextResponse.next();
  }

  // For protected routes, check for auth token
  const authToken = request.cookies.get("auth_token")?.value;
  
  if (!authToken) {
    // Redirect to login with return URL
    const loginUrl = new URL(config.loginPath, request.url);
    loginUrl.searchParams.set("returnTo", pathname);
    return NextResponse.redirect(loginUrl);
  }

  // Token exists, allow request to proceed
  // Role-based access control is handled client-side after token verification
  return NextResponse.next();
}

export const config = {
  matcher: [
    // Match all paths except static files
    "/((?!_next/static|_next/image|favicon.ico).*)",
  ],
};
