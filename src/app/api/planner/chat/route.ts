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
import { getSession } from "@/lib/auth/session";
import { checkRateLimit } from "@/lib/rate-limiter";

const MAX_MESSAGE_LENGTH = 5000;

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
    const session = await getSession();
    if (!session || (session.role !== "admin" && session.role !== "manager")) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    // Rate limit: 20 requests per hour per user
    const limit = checkRateLimit(String(session.userId), "planner_chat", 20, 3600);
    if (!limit.allowed) {
      return NextResponse.json(
        { error: `Rate limit exceeded. Try again in ${limit.retryAfter}s.` },
        { status: 429 }
      );
    }

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

    if (message.length > MAX_MESSAGE_LENGTH) {
      return NextResponse.json(
        { error: `Message too long (max ${MAX_MESSAGE_LENGTH} chars)` },
        { status: 400 }
      );
    }

    // Create or retrieve session
    let currentSessionId = sessionId;
    if (!currentSessionId) {
      const result = createChatSession(session.displayName || "Instructor");
      currentSessionId = Number(result.lastInsertRowid);
    } else {
      const chatSession = getChatSession(currentSessionId);
      if (!chatSession) {
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
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
