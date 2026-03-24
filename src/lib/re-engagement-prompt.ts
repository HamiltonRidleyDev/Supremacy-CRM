interface InsightRecord {
  category: string;
  content: string;
  source_quote?: string;
}

interface ReEngagementContact {
  first_name: string;
  last_name: string;
  contact_type: string;
  risk_level: string;
  belt_rank?: string;
  stripes?: number;
  current_program?: string;
  start_date?: string;
  monthly_rate?: number;
  last_attendance?: string;
  days_absent?: number;
  total_classes?: number;
  age_group?: string;
  goals?: string;
  motivation?: string;
  injuries_concerns?: string;
  schedule_preference?: string;
}

interface ConversationContext {
  last_message_at?: string;
  has_replied?: number;
  conv_message_count?: number;
  inbound_count?: number;
  outbound_count?: number;
}

interface RecentMessage {
  direction: string;
  content: string;
  created_at: string;
}

interface HouseholdMember {
  first_name: string;
  last_name: string;
  relationship: string;
  contact_type: string;
  monthly_revenue?: number;
}

interface PriorOutreach {
  body: string;
  tone: string;
  message_type: string;
  created_at: string;
  status: string;
}

export function buildReEngagementSystemPrompt(insights: InsightRecord[]): string {
  const hasInsights = insights.length > 0;

  const profileSection = hasInsights
    ? `## Rodrigo's Voice Profile
You have learned the following about Rodrigo through conversations. USE THIS to write in his authentic voice:

${insights.map((i) => {
  let line = `[${i.category}] ${i.content}`;
  if (i.source_quote) line += ` — "${i.source_quote}"`;
  return line;
}).join("\n")}`
    : `## Voice Guidelines
Write in a style that is:
- Direct and confident, not flowery
- Brazilian-influenced but natural English
- Practical, no-BS, competition-tested
- Community-focused — "family" is real here, not a marketing word`;

  return `You are helping Rodrigo at Supremacy BJJ write personal check-in messages to ACTIVE members who haven't been showing up lately.

CRITICAL DIFFERENCE from win-back messages: These people are STILL MEMBERS. They're paying. They haven't quit. They've just stopped coming in. The tone should be warm check-in, NOT a sales pitch or re-enrollment push.

Your job is to generate a SHORT, PERSONAL message that sounds like Rodrigo actually texted this person — NOT like an automated system or marketing blast.

${profileSection}

## Gym Context
- Supremacy BJJ, Largo FL, open since 2010
- Head instructor: Rodrigo (Brazilian, black belt)
- Programs: Adult Gi, Adult No-Gi, Kids (Tiny Ninjas, Little Ninjas), Teens
- Culture: family, real community, tough love but genuine care

## Rules — READ CAREFULLY
- NEVER use: "unleash," "journey," "transform," "unlock potential," "game-changer," "level up," "we miss you!" (generic, robotic)
- NEVER guilt-trip about not coming in
- NEVER mention their payment/billing status
- DO reference something SPECIFIC — their belt, a technique they were working on, a class they liked, how long they've been training
- DO sound like a real friend checking in, not a business following up
- If they've been absent 14-30 days: light, casual check-in ("haven't seen you around")
- If they've been absent 30-60 days: slightly more concerned, offer to help ("everything cool?")
- If they've been absent 60+ days: acknowledge the gap directly, open the door without pressure
- If you know about injuries/concerns, ask how they're doing with it
- One warm, low-pressure next step (mention a specific class time if schedule_preference is known)

## For Kids / Parent Messages
- When writing about absent kids, address the PARENT directly
- Mention kids by name, comment on their progress or what they were learning
- Frame it around the kids' experience, not the parent's obligation

## Response Format
Respond with a JSON object (no markdown fences):
{
  "body": "The message text",
  "subject": "Email subject line (only for email type, null for sms)",
  "context": "1-2 sentences explaining your approach — what angle you used and why"
}`;
}

export function buildReEngagementUserPrompt(
  contact: ReEngagementContact,
  conversation: ConversationContext | null,
  household: HouseholdMember[],
  recentMessages: RecentMessage[],
  priorOutreach: PriorOutreach[],
  messageType: "sms" | "email",
  tone: "warm" | "casual" | "concerned"
): string {
  const lines: string[] = [];

  lines.push("## Who You're Writing To");
  lines.push(`- Name: ${contact.first_name} ${contact.last_name}`);
  lines.push(`- Status: ${contact.contact_type} (risk: ${contact.risk_level || "unknown"})`);
  if (contact.belt_rank) lines.push(`- Belt: ${contact.belt_rank}${contact.stripes ? ` with ${contact.stripes} stripe(s)` : ""}`);
  if (contact.current_program) lines.push(`- Program: ${contact.current_program}`);
  if (contact.start_date) lines.push(`- Has been training since: ${contact.start_date}`);
  if (contact.monthly_rate) lines.push(`- Current rate: $${contact.monthly_rate}/mo (DO NOT mention this in the message)`);
  if (contact.last_attendance) lines.push(`- Last attended: ${contact.last_attendance}${contact.days_absent ? ` (${contact.days_absent} days ago)` : ""}`);
  if (contact.total_classes) lines.push(`- Total classes attended: ${contact.total_classes}`);

  lines.push("");
  lines.push("## What We Know About Them");
  lines.push(`- Goals: ${contact.goals || "Unknown"}`);
  lines.push(`- Motivation: ${contact.motivation || "Unknown"}`);
  if (contact.injuries_concerns) lines.push(`- Injuries/concerns: ${contact.injuries_concerns}`);
  if (contact.schedule_preference) lines.push(`- Schedule preference: ${contact.schedule_preference}`);

  if (priorOutreach.length > 0) {
    lines.push("");
    lines.push("## PRIOR OUTREACH (DO NOT REPEAT THESE)");
    lines.push("We've already contacted this person recently. Your message MUST be different:");
    for (const msg of priorOutreach) {
      const date = msg.created_at?.split("T")[0] || "unknown";
      lines.push(`- [${date}] (${msg.tone}, ${msg.message_type}, ${msg.status}): "${msg.body.slice(0, 150)}..."`);
    }
    lines.push("Write something with a DIFFERENT angle/approach than the above.");
  }

  if (recentMessages.length > 0) {
    lines.push("");
    lines.push("## Recent Message History (newest first)");
    for (const msg of recentMessages.slice(0, 5)) {
      const dir = msg.direction === "inbound" ? "THEM" : "US";
      const date = msg.created_at?.split("T")[0] || "unknown";
      lines.push(`- [${date}] ${dir}: ${msg.content?.slice(0, 200) || "(empty)"}`);
    }
  }

  if (conversation) {
    lines.push("");
    lines.push("## Communication Pattern");
    lines.push(`- Total messages exchanged: ${conversation.conv_message_count || 0}`);
    lines.push(`- Have they replied to our messages: ${conversation.has_replied ? "Yes" : "No — be aware they may not respond"}`);
    if (conversation.last_message_at) lines.push(`- Last message: ${conversation.last_message_at}`);
  }

  if (household.length > 0) {
    lines.push("");
    lines.push("## Household / Family Context");
    for (const h of household) {
      lines.push(`- ${h.first_name} ${h.last_name} (${h.relationship}) — ${h.contact_type}${h.monthly_revenue ? `, $${h.monthly_revenue}/mo` : ""}`);
    }
  }

  lines.push("");
  lines.push("## Message Parameters");
  lines.push(`- Type: ${messageType}`);
  lines.push(`- Tone: ${tone}`);

  const toneGuide: Record<string, string> = {
    warm: "Friendly, caring check-in. You genuinely want to know how they're doing.",
    casual: "Super light — like bumping into a friend. 'Hey, where you been?' energy.",
    concerned: "You've noticed they've been gone a while and you're genuinely worried. Not pushy, just real.",
  };
  lines.push(`- Tone guide: ${toneGuide[tone]}`);

  if (messageType === "sms") {
    lines.push("");
    lines.push("Keep it under 300 characters. 2-3 sentences max. Feels like a real text from Rodrigo's phone.");
  } else {
    lines.push("");
    lines.push("3-5 short paragraphs. Subject line included. Warm and personal.");
  }

  return lines.join("\n");
}
