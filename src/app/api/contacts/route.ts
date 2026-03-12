import { NextResponse } from "next/server";
import { ensureContactSchema } from "@/lib/db";
import { getContactList } from "@/lib/contacts/queries";

export async function GET(request: Request) {
  try {
    ensureContactSchema();
    const { searchParams } = new URL(request.url);

    const result = getContactList({
      page: Number(searchParams.get("page")) || 1,
      limit: Number(searchParams.get("limit")) || 50,
      type: searchParams.get("type") || undefined,
      risk: searchParams.get("risk") || undefined,
      search: searchParams.get("search") || undefined,
      sort: searchParams.get("sort") || undefined,
      order: (searchParams.get("order") as "asc" | "desc") || undefined,
    });

    return NextResponse.json(result);
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
