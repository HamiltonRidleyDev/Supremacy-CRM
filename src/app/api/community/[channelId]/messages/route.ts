import { NextResponse } from "next/server";
import { initDb } from "@/lib/db";
import { seed } from "@/lib/seed";
import { getChannelMessages, getChannelMembers, sendMessage, markChannelRead } from "@/lib/queries";
import { getDb } from "@/lib/db";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ channelId: string }> }
) {
  try {
    initDb();
    seed();
    const { channelId } = await params;
    const id = parseInt(channelId);

    const db = getDb();
    const channel = db.prepare("SELECT * FROM channels WHERE id = ?").get(id);
    const messages = getChannelMessages(id);
    const members = getChannelMembers(id);

    return NextResponse.json({ channel, messages, members });
  } catch (error) {
    console.error("API Error [GET /api/community/[channelId]/messages]:", error);
    const message = error instanceof Error ? error.message : "Internal server error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ channelId: string }> }
) {
  try {
    initDb();
    seed();
    const { channelId } = await params;
    const body = await request.json();
    const { authorId, content, parentId } = body;

    if (!authorId || !content?.trim()) {
      return NextResponse.json({ error: "authorId and content required" }, { status: 400 });
    }

    const result = sendMessage(parseInt(channelId), authorId, content.trim(), parentId);
    markChannelRead(parseInt(channelId), authorId);

    return NextResponse.json({ id: result.lastInsertRowid });
  } catch (error) {
    console.error("API Error [POST /api/community/[channelId]/messages]:", error);
    const message = error instanceof Error ? error.message : "Internal server error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
