/**
 * Auth helpers for API routes.
 *
 * Middleware sets x-user-* headers on authenticated requests.
 * These helpers read those headers for use in route handlers.
 */

import { headers } from "next/headers";

export interface RequestUser {
  userId: number;
  role: string;
  studentId: number | null;
  contactId: number | null;
}

/**
 * Get the authenticated user from middleware-injected headers.
 * Returns null if not authenticated.
 */
export async function getRequestUser(): Promise<RequestUser | null> {
  const h = await headers();
  const userId = h.get("x-user-id");
  if (!userId) return null;

  return {
    userId: Number(userId),
    role: h.get("x-user-role") || "guest",
    studentId: h.get("x-student-id") ? Number(h.get("x-student-id")) : null,
    contactId: h.get("x-contact-id") ? Number(h.get("x-contact-id")) : null,
  };
}

/**
 * Require a minimum role level. Returns the user or throws a response.
 */
export async function requireRole(minRole: string): Promise<RequestUser> {
  const user = await getRequestUser();
  if (!user) {
    throw new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 401,
      headers: { "Content-Type": "application/json" },
    });
  }

  const ROLE_HIERARCHY: Record<string, number> = {
    guest: 0,
    member: 1,
    manager: 2,
    admin: 3,
  };

  if ((ROLE_HIERARCHY[user.role] ?? 0) < (ROLE_HIERARCHY[minRole] ?? 99)) {
    throw new Response(JSON.stringify({ error: "Forbidden" }), {
      status: 403,
      headers: { "Content-Type": "application/json" },
    });
  }

  return user;
}
