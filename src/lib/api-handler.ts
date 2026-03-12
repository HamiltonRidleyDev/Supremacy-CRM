import { NextResponse } from "next/server";
import { initDb } from "@/lib/db";
import { seed } from "@/lib/seed";
import { getSession, type SessionPayload } from "@/lib/auth/session";

/**
 * Wraps an API route handler with DB init, seeding, and error handling.
 * Usage: export const GET = apiHandler(async (request) => { ... return data; });
 *
 * Options:
 *   auth: true — require a valid session (returns 401 if not authenticated)
 *   minRole: "manager" — require minimum role level (returns 403 if insufficient)
 */
export function apiHandler<T>(
  handler: (request: Request, session?: SessionPayload | null) => T | Promise<T>,
  options?: { auth?: boolean; minRole?: string }
) {
  const ROLE_HIERARCHY: Record<string, number> = {
    guest: 0,
    member: 1,
    manager: 2,
    admin: 3,
  };

  return async (request: Request) => {
    try {
      initDb();
      seed();

      // Auth check if required
      let session: SessionPayload | null = null;
      if (options?.auth) {
        session = await getSession();
        if (!session) {
          return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }
        if (options.minRole) {
          const userLevel = ROLE_HIERARCHY[session.role] ?? 0;
          const requiredLevel = ROLE_HIERARCHY[options.minRole] ?? 99;
          if (userLevel < requiredLevel) {
            return NextResponse.json({ error: "Forbidden" }, { status: 403 });
          }
        }
      }

      const result = await handler(request, session);
      // If handler already returns a NextResponse, pass it through
      if (result instanceof NextResponse) return result;
      return NextResponse.json(result);
    } catch (error) {
      console.error(`API Error [${request.method} ${request.url}]:`, error);
      const message = error instanceof Error ? error.message : "Internal server error";
      return NextResponse.json({ error: message }, { status: 500 });
    }
  };
}
