import { NextResponse } from "next/server";
import { initDb } from "@/lib/db";
import { seed } from "@/lib/seed";
import { getChannelMessages, getChannelMembers, sendMessage, markChannelRead } from "@/lib/queries";
import { getDb } from "@/lib/db";
import { getSession } from "@/lib/auth/session";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ channelId: string }> }
) {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

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
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ channelId: string }> }
) {
  try {
    // Derive author from session — prevent spoofing
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    initDb();
    seed();
    const { channelId } = await params;
    const body = await request.json();
    const { content, parentId } = body;

    if (!content?.trim()) {
      return NextResponse.json({ error: "Content required" }, { status: 400 });
    }

    if (content.length > 5000) {
      return NextResponse.json({ error: "Message too long (max 5000 chars)" }, { status: 400 });
    }

    // Use session userId as author — never trust client-provided authorId
    const authorId = session.userId;
    const result = sendMessage(parseInt(channelId), authorId, content.trim(), parentId);
    markChannelRead(parseInt(channelId), authorId);

    return NextResponse.json({ id: result.lastInsertRowid });
  } catch (error) {
    console.error("API Error [POST /api/community/[channelId]/messages]:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
