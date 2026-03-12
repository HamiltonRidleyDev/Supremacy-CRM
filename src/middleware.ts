/**
 * Global auth middleware — default-deny for API routes.
 *
 * All /api/* routes require a valid session cookie unless explicitly
 * listed in PUBLIC_API_ROUTES. Page routes are handled by layout guards.
 */

import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { jwtVerify } from "jose";

const COOKIE_NAME = "session";

// Routes that do NOT require authentication.
// Use exact path or regex patterns.
const PUBLIC_API_PATTERNS: RegExp[] = [
  /^\/api\/auth\/login$/,
  /^\/api\/access-requests$/,          // POST is public; GET/PATCH checked in handler
  /^\/api\/surveys\/respond\/[^/]+$/,  // Token-based public access
];

function isPublicRoute(pathname: string): boolean {
  return PUBLIC_API_PATTERNS.some((p) => p.test(pathname));
}

function getJwtSecret(): Uint8Array {
  const secret = process.env.JWT_SECRET;
  if (!secret) {
    throw new Error("JWT_SECRET environment variable is required");
  }
  return new TextEncoder().encode(secret);
}

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Only enforce on /api/* routes
  if (!pathname.startsWith("/api")) {
    return NextResponse.next();
  }

  // Allow public routes through
  if (isPublicRoute(pathname)) {
    return NextResponse.next();
  }

  // Require valid session cookie
  const token = request.cookies.get(COOKIE_NAME)?.value;
  if (!token) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    await jwtVerify(token, getJwtSecret());
    return NextResponse.next();
  } catch {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
}

export const config = {
  matcher: ["/api/:path*"],
};
