/**
 * JWT-based session management.
 *
 * - Admin/manager: email + password login
 * - Members: magic link (6-digit code sent to email/phone on file)
 * - Session stored as httpOnly cookie "session"
 * - JWT contains: userId, role, studentId, contactId, displayName
 */

import { SignJWT, jwtVerify, type JWTPayload } from "jose";
import { cookies } from "next/headers";

let _jwtSecret: Uint8Array | null = null;

function getJwtSecret(): Uint8Array {
  if (!_jwtSecret) {
    const secret = process.env.JWT_SECRET;
    if (!secret) {
      throw new Error(
        "JWT_SECRET environment variable is required. Generate one with: openssl rand -hex 32"
      );
    }
    _jwtSecret = new TextEncoder().encode(secret);
  }
  return _jwtSecret;
}

const COOKIE_NAME = "session";
const SESSION_DURATION = 60 * 60 * 24 * 30; // 30 days
const REFRESH_THRESHOLD = 60 * 60 * 24 * 7; // refresh when < 7 days remain

export interface SessionPayload extends JWTPayload {
  userId: number;
  role: "admin" | "manager" | "member" | "guest";
  studentId: number | null;
  contactId: number | null;
  displayName: string;
  email: string | null;
}

/**
 * Create a signed JWT session token.
 */
export async function createSession(payload: Omit<SessionPayload, "iat" | "exp">): Promise<string> {
  return new SignJWT(payload as unknown as Record<string, unknown>)
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime(`${SESSION_DURATION}s`)
    .sign(getJwtSecret());
}

/**
 * Verify and decode a session token.
 */
export async function verifySession(token: string): Promise<SessionPayload | null> {
  try {
    const { payload } = await jwtVerify(token, getJwtSecret());
    return payload as unknown as SessionPayload;
  } catch {
    return null;
  }
}

/**
 * Set the session cookie.
 */
export async function setSessionCookie(token: string) {
  const cookieStore = await cookies();
  cookieStore.set(COOKIE_NAME, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    maxAge: SESSION_DURATION,
    path: "/",
  });
}

/**
 * Get the current session from cookies.
 * Auto-refreshes the session if it's within 7 days of expiry,
 * so active users stay logged in indefinitely.
 */
export async function getSession(): Promise<SessionPayload | null> {
  const cookieStore = await cookies();
  const token = cookieStore.get(COOKIE_NAME)?.value;
  if (!token) return null;
  const session = await verifySession(token);
  if (!session) return null;

  // Auto-refresh: if session expires within REFRESH_THRESHOLD, issue a new one
  if (session.exp) {
    const secondsRemaining = session.exp - Math.floor(Date.now() / 1000);
    if (secondsRemaining > 0 && secondsRemaining < REFRESH_THRESHOLD) {
      try {
        const { userId, role, studentId, contactId, displayName, email } = session;
        const newToken = await createSession({ userId, role, studentId, contactId, displayName, email });
        await setSessionCookie(newToken);
      } catch {
        // Refresh failed silently — existing session is still valid
      }
    }
  }

  return session;
}

/**
 * Clear the session cookie.
 */
export async function clearSession() {
  const cookieStore = await cookies();
  cookieStore.delete(COOKIE_NAME);
}

/**
 * Role hierarchy for permission checks.
 * Higher index = more permissions.
 */
const ROLE_HIERARCHY: Record<string, number> = {
  guest: 0,
  member: 1,
  manager: 2,
  admin: 3,
};

/**
 * Check if a role has at least the required permission level.
 */
export function hasRole(userRole: string, requiredRole: string): boolean {
  return (ROLE_HIERARCHY[userRole] ?? 0) >= (ROLE_HIERARCHY[requiredRole] ?? 99);
}
