import { NextResponse } from "next/server";
import { apiHandler } from "@/lib/api-handler";
import {
  getContentPieces,
  updateContentStatus,
  updateContentBody,
  getContentRevisions,
  getContentQueueStats,
} from "@/lib/queries";

export const GET = apiHandler((request) => {
  const { searchParams } = new URL(request.url);
  const status = searchParams.get("status") || undefined;
  const pieceId = searchParams.get("revisions");

  if (pieceId) {
    const revisions = getContentRevisions(parseInt(pieceId));
    return { revisions };
  }

  const pieces = getContentPieces(status);
  const stats = getContentQueueStats();
  return { pieces, stats };
}, { minRole: "manager" });

export const PATCH = apiHandler(async (request) => {
  const body = await request.json();
  const { id, status, newBody } = body as {
    id: number;
    status?: string;
    newBody?: string;
  };

  if (!id) {
    return NextResponse.json({ error: "ID required" }, { status: 400 });
  }

  if (status) {
    const validStatuses = ["draft", "revision", "approved", "published", "archived"];
    if (!validStatuses.includes(status)) {
      return NextResponse.json({ error: "Invalid status" }, { status: 400 });
    }
    updateContentStatus(id, status);
  }

  if (newBody) {
    updateContentBody(id, newBody);
  }

  return NextResponse.json({ success: true });
}, { minRole: "manager" });
