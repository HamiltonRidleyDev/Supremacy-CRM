import { NextResponse } from "next/server";
import { ensureZivvySchema } from "@/lib/db";
import { runSync, getLastSync } from "@/lib/zivvy/sync";

/** GET /api/sync — returns the last sync status */
export async function GET() {
  try {
    ensureZivvySchema();
    const lastSync = getLastSync();
    return NextResponse.json({ lastSync: lastSync || null });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Unknown error" },
      { status: 500 }
    );
  }
}

/** POST /api/sync — triggers a new sync run */
export async function POST() {
  try {
    ensureZivvySchema();

    // Check if a sync is already running
    const lastSync = getLastSync();
    if (lastSync?.status === "running") {
      return NextResponse.json(
        { error: "A sync is already in progress", lastSync },
        { status: 409 }
      );
    }

    const result = await runSync();
    return NextResponse.json(result);
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Unknown error" },
      { status: 500 }
    );
  }
}
