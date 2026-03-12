import { NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import { initDb, ensureZivvySchema } from "@/lib/db";
import { seed } from "@/lib/seed";
import {
  createChatSession,
  getChatSession,
  addChatMessage,
  getChatMessages,
  getDashboardStats,
  getStrategicKPIs,
  getRevenueModelData,
  getBusinessInsights,
  getWinBackTargets,
  getAgeGroupDistribution,
  getLeadSourceDistribution,
  getGeographicBreakdown,
  getProspectPipeline,
  getInstructorInsights,
} from "@/lib/queries";
import { buildDashboardSystemPrompt } from "@/lib/dashboard-system-prompt";
import { getSession } from "@/lib/auth/session";
import { checkRateLimit } from "@/lib/rate-limiter";

const MAX_MESSAGE_LENGTH = 5000;

const anthropic = new Anthropic();

export async function POST(request: Request) {
  try {
    const session = await getSession();
    if (!session || (session.role !== "admin" && session.role !== "manager")) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    // Rate limit: 20 requests per hour per user
    const limit = checkRateLimit(String(session.userId), "dashboard_chat", 20, 3600);
    if (!limit.allowed) {
      return NextResponse.json(
        { error: `Rate limit exceeded. Try again in ${limit.retryAfter}s.` },
        { status: 429 }
      );
    }

    initDb();
    seed();
    ensureZivvySchema();

    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (!apiKey) {
      return NextResponse.json(
        { error: "ANTHROPIC_API_KEY not configured." },
        { status: 500 }
      );
    }

    const body = await request.json();
    const { message, sessionId, location } = body;

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
      const loc = location && typeof location.lat === "number" && typeof location.lng === "number"
        ? { lat: location.lat, lng: location.lng, label: location.label || undefined }
        : undefined;
      const result = createChatSession(session.displayName || "Manager", "dashboard", loc);
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

    // Gather fresh gym data for context
    const stats = getDashboardStats();
    const kpis = getStrategicKPIs();
    const revenueModel = getRevenueModelData();
    const insights = getBusinessInsights();
    const winBackTargets = getWinBackTargets();
    const ageGroups = getAgeGroupDistribution();
    const leadSources = getLeadSourceDistribution();
    const geography = getGeographicBreakdown();
    const prospectPipeline = getProspectPipeline();
    const instructorInsights = getInstructorInsights() as Array<{ category: string; content: string }>;

    const systemPrompt = buildDashboardSystemPrompt({
      stats,
      kpis,
      revenueModel,
      insights,
      winBackTargets,
      ageGroups,
      leadSources,
      geography,
      prospectPipeline,
      instructorInsights,
    });

    // Call Claude
    const response = await anthropic.messages.create({
      model: "claude-sonnet-4-20250514",
      max_tokens: 2048,
      system: systemPrompt,
      messages: history.map((m) => ({
        role: m.role as "user" | "assistant",
        content: m.content,
      })),
    });

    const text = response.content
      .filter((block) => block.type === "text")
      .map((block) => (block.type === "text" ? block.text : ""))
      .join("\n")
      .trim();

    addChatMessage(currentSessionId, "assistant", text);

    return NextResponse.json({
      response: text,
      sessionId: currentSessionId,
    });
  } catch (error) {
    console.error("API Error [POST /api/dashboard/chat]:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
