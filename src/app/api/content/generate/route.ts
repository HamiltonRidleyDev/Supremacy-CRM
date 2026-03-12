import { NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import { initDb } from "@/lib/db";
import { seed } from "@/lib/seed";
import {
  getInstructorInsights,
  createContentPiece,
  getContentPiece,
  updateContentPiece,
} from "@/lib/queries";

const anthropic = new Anthropic();

interface InsightRecord {
  category: string;
  content: string;
  source_quote?: string;
}

type ContentType =
  | "social_post"
  | "google_business"
  | "blog_snippet"
  | "lead_email"
  | "website_copy"
  | "competitor_capture";

const CONTENT_PROMPTS: Record<ContentType, string> = {
  social_post: `Write an Instagram/Facebook post for Supremacy BJJ.
- 1-3 short paragraphs, conversational and authentic
- No cringe motivational fluff. Real talk, real training.
- Include 1-2 relevant hashtags max (not a wall of hashtags)
- Should sound like a real person posted it, not a marketing agency
- If based on a lesson/technique, give a glimpse that makes people curious without giving away the whole thing`,

  google_business: `Write a Google Business Profile update for Supremacy BJJ.
- 2-3 sentences, punchy and local
- Mention Largo FL area naturally
- Focus on what makes the gym worth visiting THIS week
- Include a soft call to action (come try a class, check out the schedule, etc.)`,

  blog_snippet: `Write a short blog post / website article for Supremacy BJJ.
- 200-400 words, good for SEO
- Educational or story-driven (not salesy)
- Include a natural headline
- Write it so someone Googling BJJ in the Tampa Bay area might find it useful
- End with a soft mention of the gym, not a hard sell`,

  lead_email: `Write a follow-up email or text message for a prospective student.
- Short and personal — this should feel like a real person texting, not a template
- Reference the gym's culture and what makes it different
- Include a specific next step (come to X class, schedule a visit)
- Warm but not pushy — Rodrigo's style is confident, not desperate`,

  website_copy: `Write website copy for Supremacy BJJ.
- Could be an "About Us" section, class description, or landing page section
- Authentic and confident — not generic gym marketing
- Should capture what makes Supremacy different from every other gym
- Focus on the culture, the training approach, and the community`,

  competitor_capture: `Write outreach/marketing copy aimed at students who are leaving a competitor gym (Gracie Largo / Proof Jiujitsu).
- Empathetic, not trash-talking — acknowledge the disruption they're going through
- Position Supremacy as a stable, established gym (open since 2010)
- Highlight what they'll find: real community, experienced instruction, no drama
- Make the transition feel easy (come try a class, no commitment pressure)
- This is time-sensitive — their gym is imploding and they need a new home NOW`,
};

const PHOTO_TYPES = new Set(["social_post", "google_business", "blog_snippet", "competitor_capture"]);

function buildContentSystemPrompt(insights: InsightRecord[]): string {
  const hasInsights = insights.length > 0;

  const profileSection = hasInsights
    ? `## Rodrigo's Voice Profile
You have learned the following about Rodrigo through conversations. USE THIS to write in his authentic voice — not a sanitized marketing version, but how he actually talks and thinks:

${insights.map((i) => {
  let line = `[${i.category}] ${i.content}`;
  if (i.source_quote) line += ` — "${i.source_quote}"`;
  return line;
}).join("\n")}`
    : `## Voice Guidelines
You don't have a detailed voice profile for Rodrigo yet. Write in a style that is:
- Direct and confident, not flowery
- Brazilian-influenced but natural English
- Practical, no-BS, competition-tested
- Community-focused — "family" is real here, not a marketing word
- Dry humor when appropriate`;

  return `You are a content writer for Supremacy BJJ, a Brazilian Jiu-Jitsu gym in Largo, Florida, run by Rodrigo (black belt, open since 2010).

Your job is to generate marketing content that sounds authentically like Rodrigo and the gym — NOT like AI-generated marketing copy. The content should feel like it was written by someone who actually trains, teaches, and lives this.

${profileSection}

## Gym Facts
- Location: Largo, FL (Tampa Bay area)
- Open since: 2010
- Head instructor: Rodrigo (Brazilian, black belt)
- Classes: Adult Gi, Adult No-Gi, Kids
- Philosophy: Practical, competition-tested jiu-jitsu. Community is family. No ego.
- Staff: Kyle (front desk / assistant instructor)
- Step-up program: Government-funded kids program (13-14 enrolled, growing)
- Competitor context: Gracie Largo losing their name, rebranding to "Proof Jiujitsu" — students are displaced

## Rules
- NEVER use these words/phrases: "unleash," "journey," "transform your life," "unlock your potential," "game-changer," "level up," "crushing it"
- Avoid generic gym marketing language. If it could be posted by any gym in America, rewrite it.
- Don't over-hashtag. 1-3 max on social posts.
- Keep it real. Rodrigo's brand is authenticity — if the content feels fake, it's wrong.
- When writing about technique/training, show knowledge. Don't be vague.

## Output Format
You MUST respond with a JSON object (no markdown fences, just raw JSON):
{
  "body": "The content text here",
  "photo_direction": "A shot list / photo brief telling Kyle or Rodrigo exactly what to capture at the gym to pair with this content. Be specific and actionable — not 'take a photo of training' but 'shoot from mat level during positional sparring, catch the moment someone gets the underhook from half guard. Gi grips in focus, faces secondary. Natural gym lighting, no flash.' Include: what to shoot, when during class to shoot it, camera angle/framing, what to focus on. Or null if this content type doesn't need a photo."
}`;
}

import { getSession } from "@/lib/auth/session";
import { checkRateLimit } from "@/lib/rate-limiter";

const MAX_SOURCE_LENGTH = 10000;
const MAX_PROMPT_LENGTH = 5000;
const MAX_REVISION_LENGTH = 2000;

export async function POST(request: Request) {
  try {
  const session = await getSession();
  if (!session || (session.role !== "admin" && session.role !== "manager")) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  // Rate limit: 30 content generations per hour per user
  const limit = checkRateLimit(String(session.userId), "content_generate", 30, 3600);
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
      { error: "ANTHROPIC_API_KEY not configured" },
      { status: 500 }
    );
  }

  const body = await request.json();
  const {
    contentType,
    source,
    customPrompt,
    // Revision mode
    pieceId,
    revisionNotes,
  } = body as {
    contentType: ContentType;
    source?: string;
    customPrompt?: string;
    pieceId?: number;
    revisionNotes?: string;
  };

  const insights = getInstructorInsights() as InsightRecord[];
  const systemPrompt = buildContentSystemPrompt(insights);

  // Input length validation
  if (source && source.length > MAX_SOURCE_LENGTH) {
    return NextResponse.json({ error: `Source too long (max ${MAX_SOURCE_LENGTH} chars)` }, { status: 400 });
  }
  if (customPrompt && customPrompt.length > MAX_PROMPT_LENGTH) {
    return NextResponse.json({ error: `Prompt too long (max ${MAX_PROMPT_LENGTH} chars)` }, { status: 400 });
  }
  if (revisionNotes && revisionNotes.length > MAX_REVISION_LENGTH) {
    return NextResponse.json({ error: `Revision notes too long (max ${MAX_REVISION_LENGTH} chars)` }, { status: 400 });
  }

  // --- REVISION MODE ---
  if (pieceId && revisionNotes) {
    const existing = getContentPiece(pieceId) as {
      body: string;
      image_prompt: string | null;
      content_type: string;
    } | undefined;

    if (!existing) {
      return NextResponse.json({ error: "Content piece not found" }, { status: 404 });
    }

    const revisionPrompt = `Here is an existing piece of ${existing.content_type.replace("_", " ")} content:

---
${existing.body}
---

The author wants these changes: "${revisionNotes}"

Revise the content according to their feedback. Keep the same general format and length unless they asked for something different. Maintain the authentic voice.

Respond with a JSON object (no markdown fences):
{
  "body": "The revised content",
  "photo_direction": ${existing.image_prompt ? `"Update the photo direction if the revision changes what visual would work best, or keep the original: ${existing.image_prompt}"` : "null"}
}`;

    const response = await anthropic.messages.create({
      model: "claude-sonnet-4-20250514",
      max_tokens: 2048,
      system: systemPrompt,
      messages: [{ role: "user", content: revisionPrompt }],
    });

    const rawText = response.content
      .filter((block) => block.type === "text")
      .map((block) => (block.type === "text" ? block.text : ""))
      .join("");

    const parsed = parseJsonResponse(rawText);

    updateContentPiece(pieceId, parsed.body, parsed.image_prompt, revisionNotes);

    return NextResponse.json({
      id: pieceId,
      body: parsed.body,
      image_prompt: parsed.image_prompt,
      revised: true,
    });
  }

  // --- GENERATION MODE ---
  if (!contentType || !CONTENT_PROMPTS[contentType]) {
    return NextResponse.json({ error: "Invalid content type" }, { status: 400 });
  }

  let userPrompt = CONTENT_PROMPTS[contentType];

  if (!PHOTO_TYPES.has(contentType)) {
    userPrompt += '\n\nSet "photo_direction" to null in your response — this content type doesn\'t need a photo.';
  }

  if (source) {
    userPrompt += `\n\n## Source Material\nBase the content on this:\n\n${source}`;
  }

  if (customPrompt) {
    userPrompt += `\n\n## Additional Instructions\n${customPrompt}`;
  }

  const response = await anthropic.messages.create({
    model: "claude-sonnet-4-20250514",
    max_tokens: 2048,
    system: systemPrompt,
    messages: [{ role: "user", content: userPrompt }],
  });

  const rawText = response.content
    .filter((block) => block.type === "text")
    .map((block) => (block.type === "text" ? block.text : ""))
    .join("");

  const parsed = parseJsonResponse(rawText);

  // Persist to database
  const result = createContentPiece(
    contentType,
    parsed.body,
    parsed.image_prompt,
    source ? "provided" : "generated",
    source || customPrompt || null
  );

  return NextResponse.json({
    id: Number(result.lastInsertRowid),
    body: parsed.body,
    image_prompt: parsed.image_prompt,
    contentType,
  });
  } catch (error) {
    console.error("API Error [POST /api/content/generate]:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

function parseJsonResponse(raw: string): { body: string; image_prompt: string | null } {
  try {
    // Strip markdown code fences if the model added them
    const cleaned = raw.replace(/^```json?\s*/i, "").replace(/\s*```$/i, "").trim();
    const parsed = JSON.parse(cleaned);
    return {
      body: parsed.body || raw,
      // Accept either field name from the AI response
      image_prompt: parsed.photo_direction || parsed.image_prompt || null,
    };
  } catch {
    // If JSON parsing fails, treat the whole response as the body
    return { body: raw, image_prompt: null };
  }
}
