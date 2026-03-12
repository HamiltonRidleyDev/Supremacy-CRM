import { NextResponse } from "next/server";
import { ensureZivvySchema } from "@/lib/db";
import { runSync, getLastSync } from "@/lib/zivvy/sync";
import { apiHandler } from "@/lib/api-handler";

/** GET /api/sync — returns the last sync status */
export const GET = apiHandler(() => {
  ensureZivvySchema();
  const lastSync = getLastSync();
  return { lastSync: lastSync || null };
}, { minRole: "manager" });

/** POST /api/sync — triggers a new sync run */
export const POST = apiHandler(async () => {
  ensureZivvySchema();

  const lastSync = getLastSync();
  if (lastSync?.status === "running") {
    return NextResponse.json(
      { error: "A sync is already in progress", lastSync },
      { status: 409 }
    );
  }

  const result = await runSync();
  return result;
}, { minRole: "admin" });
