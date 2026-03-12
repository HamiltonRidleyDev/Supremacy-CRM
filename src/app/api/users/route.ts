import { NextResponse } from "next/server";
import { apiHandler } from "@/lib/api-handler";
import { getUsers, updateUserRole } from "@/lib/queries";

export const GET = apiHandler(() => getUsers(), { minRole: "admin" });

export const PATCH = apiHandler(async (request) => {
  const body = await request.json();
  const { userId, role } = body;

  if (!userId || !["admin", "manager", "member", "guest"].includes(role)) {
    return NextResponse.json({ error: "Valid userId and role required" }, { status: 400 });
  }

  updateUserRole(userId, role);
  return NextResponse.json({ success: true });
}, { minRole: "admin" });
