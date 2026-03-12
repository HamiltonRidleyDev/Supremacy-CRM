import { NextResponse } from "next/server";
import { ensureContactSchema } from "@/lib/db";
import { getContactList } from "@/lib/contacts/queries";
import { apiHandler } from "@/lib/api-handler";

export const GET = apiHandler((request) => {
  ensureContactSchema();
  const { searchParams } = new URL(request.url);

  const rawLimit = Number(searchParams.get("limit")) || 50;
  const order = searchParams.get("order");

  return getContactList({
    page: Number(searchParams.get("page")) || 1,
    limit: Math.min(Math.max(rawLimit, 1), 200),
    type: searchParams.get("type") || undefined,
    risk: searchParams.get("risk") || undefined,
    search: searchParams.get("search") || undefined,
    sort: searchParams.get("sort") || undefined,
    order: order === "asc" || order === "desc" ? order : undefined,
  });
}, { minRole: "manager" });
