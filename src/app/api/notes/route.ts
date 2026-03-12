import { NextResponse } from "next/server";
import { apiHandler } from "@/lib/api-handler";
import { getNotes, createNote, deleteNote } from "@/lib/queries";

export const GET = apiHandler(() => getNotes(), { minRole: "manager" });

export const POST = apiHandler(async (request) => {
  const body = await request.json();
  const { content, tags } = body;

  if (!content || typeof content !== "string" || content.trim().length === 0) {
    return NextResponse.json({ error: "Content is required" }, { status: 400 });
  }

  const result = createNote("Rodrigo", content.trim(), tags);
  return NextResponse.json({ id: result.lastInsertRowid });
}, { minRole: "manager" });

export const DELETE = apiHandler((request) => {
  const { searchParams } = new URL(request.url);
  const id = parseInt(searchParams.get("id") || "0");

  if (!id) {
    return NextResponse.json({ error: "ID is required" }, { status: 400 });
  }

  deleteNote(id);
  return NextResponse.json({ success: true });
}, { minRole: "manager" });
