import { NextResponse } from "next/server";
import { initDb } from "@/lib/db";
import { seed } from "@/lib/seed";
import { getSession, type SessionPayload } from "@/lib/auth/session";

const ROLE_HIERARCHY: Record<string, number> = {
  guest: 0,
  member: 1,
  manager: 2,
  admin: 3,
};

/**
 * Wraps an API route handler with DB init, seeding, auth, and error handling.
 *
 * By default, ALL routes require authentication. Use `auth: false` to opt out
 * (only for truly public endpoints like health checks or access requests).
 *
 * Options:
 *   auth: false — skip authentication (default: true)
 *   minRole: "manager" — require minimum role level (returns 403 if insufficient)
 */
export function apiHandler<T>(
  handler: (request: Request, session: SessionPayload) => T | Promise<T>,
  options?: { auth?: true; minRole?: string }
): (request: Request) => Promise<NextResponse>;
export function apiHandler<T>(
  handler: (request: Request, session: null) => T | Promise<T>,
  options: { auth: false }
): (request: Request) => Promise<NextResponse>;
export function apiHandler<T>(
  handler: (request: Request, session: any) => T | Promise<T>,
  options?: { auth?: boolean; minRole?: string }
) {
  // Default to requiring auth
  const requireAuth = options?.auth !== false;

  return async (request: Request) => {
    try {
      initDb();
      seed();

      let session: SessionPayload | null = null;
      if (requireAuth) {
        session = await getSession();
        if (!session) {
          return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }
        if (options?.minRole) {
          const userLevel = ROLE_HIERARCHY[session.role] ?? 0;
          const requiredLevel = ROLE_HIERARCHY[options.minRole] ?? 99;
          if (userLevel < requiredLevel) {
            return NextResponse.json({ error: "Forbidden" }, { status: 403 });
          }
        }
      }

      const result = await handler(request, session);
      if (result instanceof NextResponse) return result;
      return NextResponse.json(result);
    } catch (error) {
      console.error(`API Error [${request.method} ${request.url}]:`, error);
      // Never leak internal error details to the client
      return NextResponse.json(
        { error: "Internal server error" },
        { status: 500 }
      );
    }
  };
}
