import { NextResponse } from "next/server";
import { ensureMMSchema } from "@/lib/db";
import { runMMSync, getLastMMSync } from "@/lib/marketmuscles/sync";

/** GET /api/sync-mm — returns the last MM sync status */
export async function GET() {
  try {
    ensureMMSchema();
    const lastSync = getLastMMSync();
    return NextResponse.json({ lastSync: lastSync || null });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Unknown error" },
      { status: 500 }
    );
  }
}

/** POST /api/sync-mm — triggers a new Market Muscles sync */
export async function POST() {
  try {
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
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Unknown error" },
      { status: 500 }
    );
  }
}
