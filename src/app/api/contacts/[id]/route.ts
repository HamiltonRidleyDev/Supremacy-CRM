import { NextResponse } from "next/server";
import { ensureContactSchema } from "@/lib/db";
import { getContactDetail } from "@/lib/contacts/queries";
import { getSession, hasRole } from "@/lib/auth/session";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getSession();
    if (!session || !hasRole(session.role, "manager")) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    ensureContactSchema();
    const { id } = await params;
    const contactId = parseInt(id, 10);

    if (isNaN(contactId)) {
      return NextResponse.json({ error: "Invalid contact ID" }, { status: 400 });
    }

    const result = getContactDetail(contactId);
    if (!result) {
      return NextResponse.json({ error: "Contact not found" }, { status: 404 });
    }

    return NextResponse.json(result);
  } catch (error) {
    console.error("API Error [GET /api/contacts/[id]]:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
