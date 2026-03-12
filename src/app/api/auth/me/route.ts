import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth/session";

/**
 * GET /api/auth/me — Return current session info
 */
export async function GET() {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ authenticated: false }, { status: 401 });
  }

  return NextResponse.json({
    authenticated: true,
    user: {
      userId: session.userId,
      role: session.role,
      studentId: session.studentId,
      contactId: session.contactId,
      displayName: session.displayName,
      email: session.email,
    },
  });
}
