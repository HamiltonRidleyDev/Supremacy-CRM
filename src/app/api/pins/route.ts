import { NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import { apiHandler } from "@/lib/api-handler";
import { createPinnedItem, getPinnedItems, updatePinnedItemStatus } from "@/lib/queries";

const anthropic = new Anthropic();

export const GET = apiHandler(() => {
  return getPinnedItems("active");
}, { minRole: "manager" });

export const POST = apiHandler(async (request, session) => {
  const body = await request.json();
  const { sessionId, userMessage, assistantMessage } = body;

  if (!sessionId || !userMessage || !assistantMessage) {
    return NextResponse.json(
      { error: "sessionId, userMessage, and assistantMessage are required" },
      { status: 400 }
    );
  }

  // Generate a one-line context summary using AI
  let contextSummary: string | null = null;
  try {
    const response = await anthropic.messages.create({
      model: "claude-haiku-4-5-20251001",
      max_tokens: 150,
      messages: [{
        role: "user",
        content: `Summarize this exchange in one concise sentence for future reference. Focus on the actionable takeaway, not what was discussed. Be specific with names, numbers, and next steps.

User asked: "${userMessage}"

AI responded: "${assistantMessage.slice(0, 1000)}"

One-sentence summary:`,
      }],
    });
    const text = response.content[0];
    if (text.type === "text") {
      contextSummary = text.text.trim();
    }
  } catch {
    // If summary generation fails, pin without it
  }

  const result = createPinnedItem(
    sessionId,
    userMessage,
    assistantMessage,
    contextSummary,
    session.displayName || "Staff"
  );

  return {
    id: Number(result.lastInsertRowid),
    contextSummary,
  };
}, { minRole: "manager" });

export const PATCH = apiHandler(async (request) => {
  const body = await request.json();
  const { id, status } = body as { id: number; status: string };

  if (!id || !status) {
    return NextResponse.json(
      { error: "id and status are required" },
      { status: 400 }
    );
  }

  const validStatuses = ["active", "dismissed", "done"];
  if (!validStatuses.includes(status)) {
    return NextResponse.json(
      { error: "Invalid status" },
      { status: 400 }
    );
  }

  updatePinnedItemStatus(id, status);
  return { success: true };
}, { minRole: "manager" });
