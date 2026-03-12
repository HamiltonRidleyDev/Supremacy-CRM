import { NextResponse } from "next/server";
import { initDb } from "@/lib/db";
import { seed } from "@/lib/seed";
import { getSurveyTemplate, updateSurveyTemplate } from "@/lib/queries";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    initDb(); seed();
    const { id } = await params;
    const template = getSurveyTemplate(Number(id));
    if (!template) return NextResponse.json({ error: "Not found" }, { status: 404 });
    return NextResponse.json(template);
  } catch (error) {
    const msg = error instanceof Error ? error.message : "Internal server error";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

export async function PUT(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    initDb(); seed();
    const { id } = await params;
    const body = await request.json();
    const updates: { name?: string; description?: string; questions?: string; is_active?: number } = {};
    if (body.name !== undefined) updates.name = body.name;
    if (body.description !== undefined) updates.description = body.description;
    if (body.questions !== undefined) updates.questions = typeof body.questions === "string" ? body.questions : JSON.stringify(body.questions);
    if (body.is_active !== undefined) updates.is_active = body.is_active;
    updateSurveyTemplate(Number(id), updates);
    return NextResponse.json({ success: true });
  } catch (error) {
    const msg = error instanceof Error ? error.message : "Internal server error";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    initDb(); seed();
    const { id } = await params;
    updateSurveyTemplate(Number(id), { is_active: 0 });
    return NextResponse.json({ success: true });
  } catch (error) {
    const msg = error instanceof Error ? error.message : "Internal server error";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
