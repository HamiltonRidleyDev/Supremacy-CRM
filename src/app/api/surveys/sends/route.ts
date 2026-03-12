import { apiHandler } from "@/lib/api-handler";
import { getSurveySends, createSurveySend, getSurveyTemplate } from "@/lib/queries";
import { getDb } from "@/lib/db";
import { NextResponse } from "next/server";
import crypto from "crypto";

export const GET = apiHandler((request: Request) => {
  const url = new URL(request.url);
  const templateId = url.searchParams.get("template_id");
  const status = url.searchParams.get("status");
  return getSurveySends(templateId ? Number(templateId) : undefined, status || undefined);
});

export const POST = apiHandler(async (request: Request) => {
  const body = await request.json();
  const { template_id, recipient_type, recipient_ids, sent_via } = body;

  if (!template_id || !recipient_ids || !Array.isArray(recipient_ids) || recipient_ids.length === 0) {
    return NextResponse.json({ error: "template_id and recipient_ids[] are required" }, { status: 400 });
  }

  const template = getSurveyTemplate(template_id);
  if (!template) {
    return NextResponse.json({ error: "Template not found" }, { status: 404 });
  }

  const db = getDb();
  const type = recipient_type || "student";
  const results: { token: string; name: string; id: number }[] = [];

  for (const rid of recipient_ids) {
    let name = "", email: string | null = null, phone: string | null = null;
    let studentId: number | null = null, leadId: number | null = null;

    if (type === "student") {
      const s = db.prepare("SELECT first_name, last_name, email, phone FROM students WHERE id = ?").get(rid) as
        { first_name: string; last_name: string; email: string | null; phone: string | null } | undefined;
      if (!s) continue;
      name = `${s.first_name} ${s.last_name}`.trim();
      email = s.email; phone = s.phone; studentId = rid;
    } else {
      const l = db.prepare("SELECT first_name, last_name, email, phone FROM leads WHERE id = ?").get(rid) as
        { first_name: string; last_name: string; email: string | null; phone: string | null } | undefined;
      if (!l) continue;
      name = `${l.first_name} ${l.last_name || ""}`.trim();
      email = l.email; phone = l.phone; leadId = rid;
    }

    const token = crypto.randomUUID();
    createSurveySend(template_id, token, name, email, phone, studentId, leadId, sent_via || null);
    results.push({ token, name, id: rid });
  }

  return { sent: results.length, links: results.map(r => ({ ...r, url: `/s/${r.token}` })) };
});
