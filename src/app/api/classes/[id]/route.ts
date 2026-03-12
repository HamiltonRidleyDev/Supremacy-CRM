import { NextResponse } from "next/server";
import { initDb } from "@/lib/db";
import { seed } from "@/lib/seed";
import { getClassAttendees } from "@/lib/queries";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    initDb();
    seed();
    const { id } = await params;
    return NextResponse.json(getClassAttendees(parseInt(id)));
  } catch (error) {
    console.error("API Error [GET /api/classes/[id]]:", error);
    const message = error instanceof Error ? error.message : "Internal server error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
