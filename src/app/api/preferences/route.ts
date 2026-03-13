import { NextResponse } from "next/server";
import { apiHandler } from "@/lib/api-handler";
import { getDb } from "@/lib/db";

/**
 * GET /api/preferences — Get current user's preferences
 */
export const GET = apiHandler((_, session) => {
  const db = getDb();
  const row = db.prepare(
    "SELECT value FROM app_settings WHERE key = ?"
  ).get(`prefs_${session.userId}`) as { value: string } | undefined;

  return row ? JSON.parse(row.value) : {};
}, { minRole: "manager" });

/**
 * PATCH /api/preferences — Update current user's preferences
 */
export const PATCH = apiHandler(async (request, session) => {
  const body = await request.json();
  const db = getDb();

  // Get existing prefs
  const row = db.prepare(
    "SELECT value FROM app_settings WHERE key = ?"
  ).get(`prefs_${session.userId}`) as { value: string } | undefined;

  const existing = row ? JSON.parse(row.value) : {};
  const updated = { ...existing, ...body };

  db.prepare(
    "INSERT OR REPLACE INTO app_settings (key, value, updated_at) VALUES (?, ?, datetime('now'))"
  ).run(`prefs_${session.userId}`, JSON.stringify(updated));

  return updated;
}, { minRole: "manager" });
