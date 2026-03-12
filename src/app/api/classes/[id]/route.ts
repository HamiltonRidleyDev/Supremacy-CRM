import { NextResponse } from "next/server";
import { initDb } from "@/lib/db";
import { seed } from "@/lib/seed";
import { getClassAttendees } from "@/lib/queries";
import { getSession, hasRole } from "@/lib/auth/session";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getSession();
    if (!session || !hasRole(session.role, "member")) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    initDb();
    seed();
    const { id } = await params;
    return NextResponse.json(getClassAttendees(parseInt(id)));
  } catch (error) {
    console.error("API Error [GET /api/classes/[id]]:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
