interface InsightRecord {
  category: string;
  content: string;
  source_quote?: string;
}

interface WinBackContact {
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
  quit_reason?: string;
  willing_to_return?: string;
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

interface HouseholdMember {
  first_name: string;
  last_name: string;
  relationship: string;
  contact_type: string;
  monthly_revenue?: number;
}

interface RecentMessage {
  direction: string;
  content: string;
  created_at: string;
}

export function buildWinBackSystemPrompt(insights: InsightRecord[]): string {
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

  return `You are helping Rodrigo and Kyle at Supremacy BJJ write personal win-back messages to former or at-risk members.

Your job is to generate a SHORT, PERSONAL message that sounds like Rodrigo (or Kyle) actually texted/emailed this person — NOT like an automated template.

${profileSection}

## Gym Context
- Supremacy BJJ, Largo FL, open since 2010
- Head instructor: Rodrigo (Brazilian, black belt)
- Kyle: front desk / assistant instructor
- Programs: Adult Gi, Adult No-Gi, Kids (Tiny Ninjas, Little Ninjas), Teens
- Step-up program: government-funded kids program, growing fast
- Competitor Gracie Largo is imploding (rebranding to "Proof Jiujitsu") — displaced students looking for a new home

## Rules
- NEVER use: "unleash," "journey," "transform," "unlock potential," "game-changer," "level up," "we miss you!" (generic)
- Reference something SPECIFIC about this person — their belt, program, how long they trained, a class they liked
- If you know why they left, address it naturally (don't ignore the elephant)
- If they have family still training, mention it warmly ("your kid is still crushing it in Little Ninjas")
- If they stopped replying to messages, acknowledge the gap without guilt-tripping
- Sound like a real human text/email, not a marketing blast
- One clear next step (come to a specific class, stop by, etc.)

## Household / Parent Messages
- When the recipient is a PARENT and the absent members are their CHILDREN, address the parent directly
- Reference each child BY NAME — e.g., "Hey Crystal, we haven't seen Asher, Silas, and Ezra in a while"
- If multiple kids are absent, write ONE message about all of them — don't be repetitive
- For kids' programs (Tiny Ninjas, Little Ninjas), keep the tone encouraging about the kids' progress
- If only some kids are absent but others are still attending, mention that naturally
- NEVER write the message as if you're texting the child directly — always address the parent

## Response Format
Respond with a JSON object (no markdown fences):
{
  "body": "The message text",
  "subject": "Email subject line (only for email type, null for sms)",
  "context": "1-2 sentences explaining why you chose this approach — what angle you're using and why it should work for this person"
}`;
}

export function buildWinBackUserPrompt(
  contact: WinBackContact,
  conversation: ConversationContext | null,
  household: HouseholdMember[],
  recentMessages: RecentMessage[],
  messageType: "sms" | "email",
  tone: "warm" | "casual" | "urgent"
): string {
  const lines: string[] = [];

  lines.push("## Who You're Writing To");
  lines.push(`- Name: ${contact.first_name} ${contact.last_name}`);
  lines.push(`- Status: ${contact.contact_type} (risk: ${contact.risk_level || "unknown"})`);
  if (contact.belt_rank) lines.push(`- Belt: ${contact.belt_rank}${contact.stripes ? ` with ${contact.stripes} stripe(s)` : ""}`);
  if (contact.current_program) lines.push(`- Program: ${contact.current_program}`);
  if (contact.start_date) lines.push(`- Started training: ${contact.start_date}`);
  if (contact.monthly_rate) lines.push(`- Was paying: $${contact.monthly_rate}/mo`);
  if (contact.last_attendance) lines.push(`- Last attended: ${contact.last_attendance}${contact.days_absent ? ` (${contact.days_absent} days ago)` : ""}`);
  if (contact.total_classes) lines.push(`- Total classes attended: ${contact.total_classes}`);
  if (contact.age_group) lines.push(`- Age group: ${contact.age_group}`);

  lines.push("");
  lines.push("## What We Know About Why They Left");
  lines.push(`- Quit reason: ${contact.quit_reason || "Unknown — you'll need to be exploratory"}`);
  lines.push(`- Willing to return: ${contact.willing_to_return || "Unknown"}`);
  lines.push(`- Original goals: ${contact.goals || "Unknown"}`);
  lines.push(`- Motivation: ${contact.motivation || "Unknown"}`);
  if (contact.injuries_concerns) lines.push(`- Injuries/concerns: ${contact.injuries_concerns}`);
  if (contact.schedule_preference) lines.push(`- Schedule preference: ${contact.schedule_preference}`);

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
    lines.push(`- They sent: ${conversation.inbound_count || 0}, We sent: ${conversation.outbound_count || 0}`);
    lines.push(`- Have they replied to our messages: ${conversation.has_replied ? "Yes" : "No"}`);
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

  if (messageType === "sms") {
    lines.push("");
    lines.push("Keep it under 300 characters. 2-3 sentences max. Feels like a real text from a friend. No links. One clear CTA.");
  } else {
    lines.push("");
    lines.push("3-5 short paragraphs. Include a subject line. Personal, not template-y. One clear CTA at the end.");
  }

  const toneGuide: Record<string, string> = {
    warm: "Empathetic and caring — you genuinely want to know how they're doing and want them back in the family.",
    casual: "Buddy check-in — light, no pressure, just keeping the door open. Like texting a friend you haven't seen in a while.",
    urgent: "There's something specific happening (event, promotion, schedule change, competitor closing) that creates a natural reason to reach out NOW.",
  };
  lines.push(`- Tone guide: ${toneGuide[tone]}`);

  return lines.join("\n");
}

// ---- Household-aware prompt (parent + absent children) ----

export interface ChildInfo {
  id?: number;
  first_name: string;
  last_name: string;
  age_group: string | null;
  belt_rank: string | null;
  stripes: number | null;
  current_program: string | null;
  total_classes: number | null;
  days_absent: number | null;
  last_attendance: string | null;
  risk_level: string | null;
  risk_factors: string[];
  monthly_rate: number | null;
  quit_reason: string | null;
}

export function buildHouseholdWinBackPrompt(
  parentName: string,
  children: ChildInfo[],
  conversation: ConversationContext | null,
  recentMessages: RecentMessage[],
  messageType: "sms" | "email",
  tone: "warm" | "casual" | "urgent"
): string {
  const lines: string[] = [];

  lines.push("## IMPORTANT: This is a message to a PARENT about their CHILDREN");
  lines.push(`You are writing to ${parentName} about their ${children.length} kid${children.length > 1 ? "s" : ""} who ${children.length > 1 ? "have" : "has"} been absent.`);
  lines.push("Address the parent directly. Reference each child by first name.");
  if (children.length > 1) {
    lines.push("Write ONE message covering all children — do NOT repeat yourself for each kid.");
  }

  lines.push("");
  lines.push("## The Parent (Message Recipient)");
  lines.push(`- Name: ${parentName}`);

  lines.push("");
  lines.push("## Their Children Who Are Absent");
  for (const child of children) {
    const parts: string[] = [`**${child.first_name} ${child.last_name}**`];
    if (child.age_group) parts.push(`(${child.age_group})`);
    if (child.belt_rank) parts.push(`— ${child.belt_rank}${child.stripes ? ` ${child.stripes}s` : ""} belt`);
    if (child.days_absent != null) parts.push(`— ${child.days_absent} days absent`);
    if (child.total_classes) parts.push(`— ${child.total_classes} classes total`);
    if (child.current_program) parts.push(`— program: ${child.current_program}`);
    if (child.monthly_rate) parts.push(`— $${child.monthly_rate}/mo`);
    lines.push(`- ${parts.join(" ")}`);
    if (child.quit_reason) lines.push(`  Quit reason: ${child.quit_reason}`);
    if (child.risk_factors.length > 0) lines.push(`  Risk signals: ${child.risk_factors.join(", ")}`);
  }

  // Combined revenue at risk
  const totalRevenue = children.reduce((sum, c) => sum + (c.monthly_rate || 0), 0);
  if (totalRevenue > 0) {
    lines.push("");
    lines.push(`Total family revenue at risk: $${totalRevenue}/mo`);
  }

  if (recentMessages.length > 0) {
    lines.push("");
    lines.push("## Recent Message History with Parent (newest first)");
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
    lines.push(`- Have they replied to our messages: ${conversation.has_replied ? "Yes" : "No"}`);
    if (conversation.last_message_at) lines.push(`- Last message: ${conversation.last_message_at}`);
  }

  lines.push("");
  lines.push("## Message Parameters");
  lines.push(`- Type: ${messageType}`);
  lines.push(`- Tone: ${tone}`);

  if (messageType === "sms") {
    lines.push("");
    if (children.length <= 2) {
      lines.push("Keep it under 300 characters. 2-3 sentences. Real text from a real person.");
    } else {
      lines.push("This can be slightly longer since you need to mention multiple kids — up to 400 characters. But still concise.");
    }
  } else {
    lines.push("");
    lines.push("3-5 short paragraphs. Include a subject line. Personal, not template-y.");
  }

  const toneGuide: Record<string, string> = {
    warm: "Caring parent-to-parent tone. You care about their kids' development.",
    casual: "Light check-in. 'Hey, haven't seen the kids around lately — everything good?'",
    urgent: "Something exciting happening — new kids program, tournament, belt testing coming up.",
  };
  lines.push(`- Tone guide: ${toneGuide[tone]}`);

  return lines.join("\n");
}
