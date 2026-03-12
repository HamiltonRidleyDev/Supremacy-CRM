import { NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import { initDb } from "@/lib/db";
import { seed } from "@/lib/seed";
import {
  createChatSession,
  getChatSession,
  addChatMessage,
  getChatMessages,
  getInstructorInsights,
  addInsight,
} from "@/lib/queries";
import { buildSystemPrompt } from "@/lib/system-prompt";

const anthropic = new Anthropic();

// Parse <insight> tags from AI response and store them
function extractAndStoreInsights(
  text: string,
  sessionId: number
): string {
  const insightRegex =
    /<insight\s+category="([^"]+)"\s+quote="([^"]*)">([\s\S]*?)<\/insight>/g;

  let match;
  while ((match = insightRegex.exec(text)) !== null) {
    const [, category, quote, observation] = match;
    addInsight(category, observation.trim(), sessionId, quote || undefined);
  }

  // Strip insight tags from displayed text
  return text.replace(
    /<insight\s+category="[^"]+"\s+quote="[^"]*">[\s\S]*?<\/insight>/g,
    ""
  ).replace(/\n{3,}/g, "\n\n").trim();
}

export async function POST(request: Request) {
  try {
  initDb();
  seed();

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return NextResponse.json(
      { error: "ANTHROPIC_API_KEY not configured. Add it to your .env file." },
      { status: 500 }
    );
  }

  const body = await request.json();
  const { message, sessionId } = body;

  if (!message || typeof message !== "string" || message.trim().length === 0) {
    return NextResponse.json({ error: "Message is required" }, { status: 400 });
  }

  // Create or retrieve session
  let currentSessionId = sessionId;
  if (!currentSessionId) {
    const result = createChatSession("Rodrigo");
    currentSessionId = Number(result.lastInsertRowid);
  } else {
    const session = getChatSession(currentSessionId);
    if (!session) {
      return NextResponse.json({ error: "Session not found" }, { status: 404 });
    }
  }

  // Store user message
  addChatMessage(currentSessionId, "user", message.trim());

  // Build conversation history
  const history = getChatMessages(currentSessionId) as {
    role: string;
    content: string;
  }[];

  // Get existing instructor insights for context
  const insights = getInstructorInsights() as {
    category: string;
    content: string;
    source_quote?: string;
  }[];

  // Build system prompt with profile context
  const systemPrompt = buildSystemPrompt(insights);

  // Call Claude
  const response = await anthropic.messages.create({
    model: "claude-sonnet-4-20250514",
    max_tokens: 4096,
    system: systemPrompt,
    messages: history.map((m) => ({
      role: m.role as "user" | "assistant",
      content: m.content,
    })),
  });

  // Extract text from response
  const rawText = response.content
    .filter((block) => block.type === "text")
    .map((block) => {
      if (block.type === "text") return block.text;
      return "";
    })
    .join("\n");

  // Extract insights and clean the response
  const cleanText = extractAndStoreInsights(rawText, currentSessionId);

  // Store assistant response (clean version without insight tags)
  addChatMessage(currentSessionId, "assistant", cleanText);

  return NextResponse.json({
    response: cleanText,
    sessionId: currentSessionId,
  });
  } catch (error) {
    console.error("API Error [POST /api/planner/chat]:", error);
    const message = error instanceof Error ? error.message : "Internal server error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
