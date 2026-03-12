import { NextResponse } from "next/server";
import { ensureMMSchema } from "@/lib/db";
import { runMMSync, getLastMMSync } from "@/lib/marketmuscles/sync";
import { getSession, hasRole } from "@/lib/auth/session";

/** GET /api/sync-mm — returns the last MM sync status */
export async function GET() {
  try {
    const session = await getSession();
    if (!session || !hasRole(session.role, "admin")) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    ensureMMSchema();
    const lastSync = getLastMMSync();
    return NextResponse.json({ lastSync: lastSync || null });
  } catch (err) {
    console.error("API Error [GET /api/sync-mm]:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

/** POST /api/sync-mm — triggers a new Market Muscles sync */
export async function POST() {
  try {
    const session = await getSession();
    if (!session || !hasRole(session.role, "admin")) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    ensureMMSchema();

    // Check if a sync is already running
    const lastSync = getLastMMSync();
    if ((lastSync as any)?.status === "running") {
      return NextResponse.json(
        { error: "A Market Muscles sync is already in progress", lastSync },
        { status: 409 }
      );
    }

    const result = await runMMSync();
    return NextResponse.json(result);
  } catch (err) {
    console.error("API Error [POST /api/sync-mm]:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
