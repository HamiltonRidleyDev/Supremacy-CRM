import { NextResponse } from "next/server";
import { getDb, ensureMMSchema } from "@/lib/db";

/**
 * GET /api/mm-insights/topics — Analyze conversation topics from inbound messages.
 * Groups messages by common themes to identify what prospects/students ask about.
 * No AI needed — uses keyword matching and categorization for speed.
 */
export async function GET() {
  try {
    ensureMMSchema();
    const db = getDb();

    // Get all inbound messages with meaningful content
    const messages = db.prepare(`
      SELECT m.id, m.content, m.thread_id, m.contact_id, m.created_at,
             c.contact_name, mc.tags as contact_tags
      FROM mm_messages m
      LEFT JOIN mm_conversations c ON c.thread_id = m.thread_id
      LEFT JOIN mm_contacts mc ON mc.id = m.contact_id
      WHERE m.direction = 'inbound'
        AND m.content IS NOT NULL
        AND LENGTH(m.content) > 10
        AND m.content NOT LIKE '%has opted out%'
        AND m.content NOT LIKE '%re-subscribed%'
        AND m.content NOT LIKE '%STOP%'
      ORDER BY m.created_at DESC
    `).all() as Array<{
      id: string; content: string; thread_id: string; contact_id: string;
      created_at: string; contact_name: string; contact_tags: string;
    }>;

    // Topic definitions with keyword patterns
    const topicDefs: Array<{
      topic: string;
      keywords: RegExp;
      category: "inquiry" | "logistics" | "objection" | "feedback" | "conversion";
    }> = [
      // Inquiry topics — what are they interested in?
      { topic: "Pricing / Cost", keywords: /pric|cost|how much|monthly|rate|fee|pay|afford|expensive|cheap|deal|discount|plan.*\d|plano|\$|\bfee\b/i, category: "inquiry" },
      { topic: "Schedule / Hours", keywords: /schedul|hours|time|when.*class|what time|class.*time|hor[aá]rio|open.*mat|when.*open/i, category: "inquiry" },
      { topic: "Kids Program", keywords: /kid|child|son|daughter|boy|girl|year.?old|\d+\s*yr|\btiny\b|little.?ninja|youth|toddler|enroll.*child/i, category: "inquiry" },
      { topic: "Free Trial / First Visit", keywords: /free.*trial|trial.*free|first.*class|intro.*class|try.*out|come.*check|visit|walk.?in|introductory/i, category: "inquiry" },
      { topic: "BJJ Interest", keywords: /\bbjj\b|jiu.?jitsu|jujitsu|grappl|submiss|guard|roll|gi\b|nogi|no.?gi/i, category: "inquiry" },
      { topic: "Muay Thai / Striking", keywords: /muay.?thai|kick.?box|striking|boxing|stand.?up/i, category: "inquiry" },
      { topic: "Beginner Friendly", keywords: /beginner|no.*experience|never.*train|first.*time|new.*to|start.*learn|how.*start/i, category: "inquiry" },
      { topic: "Self Defense", keywords: /self.?def|protect|bully|safe|confidence|focus|discipline/i, category: "inquiry" },
      { topic: "Fitness / Weight Loss", keywords: /fitness|weight|shape|exercise|workout|cardio|health|lose/i, category: "inquiry" },
      { topic: "Special Needs", keywords: /special.?need|autis|adhd|disab|accommodat/i, category: "inquiry" },
      { topic: "Law Enforcement / Military", keywords: /law.?enforce|police|military|veteran|first.?respond|officer|leo\b/i, category: "inquiry" },

      // Logistics — scheduling, directions, gear
      { topic: "Location / Directions", keywords: /where.*locat|address|ulmerton|largo|direction|find.*you|map|parking/i, category: "logistics" },
      { topic: "Gi / Equipment", keywords: /\bgi\b.*buy|\bgi\b.*need|\bgi\b.*rent|equipment|gear|what.*wear|what.*bring|uniform|loaner/i, category: "logistics" },
      { topic: "Booking / Appointment", keywords: /book|appoint|reserv|sign.*up|register|enroll(?!.*child)/i, category: "logistics" },
      { topic: "Visiting / Drop-In", keywords: /visit|drop.?in|in.?town|vacation|travel|passing.*through/i, category: "logistics" },

      // Objections / Concerns
      { topic: "Scheduling Conflict", keywords: /work.*during|can't.*make|not.*available|busy|conflict|off.*on|schedule.*doesn't/i, category: "objection" },
      { topic: "Injury / Health Concern", keywords: /injur|hurt|knee|back|shoulder|surger|recover|medical|doctor|health.*concern/i, category: "objection" },
      { topic: "Billing Issue", keywords: /bill|charg|payment|bank|refund|cancel.*member|overcharg|invoice|deduct/i, category: "objection" },

      // Positive / Conversion signals
      { topic: "Ready to Start", keywords: /sign.*up|ready.*start|want.*join|when.*can.*start|see.*you|be.*there|coming|come.*in/i, category: "conversion" },
      { topic: "Positive Feedback", keywords: /enjoy|love|great.*class|amazing|thank|awesome|fun|fantastic/i, category: "feedback" },
      { topic: "Referral", keywords: /friend|refer|recommend|told.*about|someone.*mentioned|buddy|grandson|nephew/i, category: "inquiry" },
    ];

    // Categorize each message
    type TopicHit = {
      topic: string;
      category: string;
      messages: Array<{
        id: string;
        content: string;
        contact_name: string;
        contact_id: string;
        created_at: string;
      }>;
      count: number;
      uniqueContacts: number;
    };

    const topicMap = new Map<string, TopicHit>();
    const uncategorized: typeof messages = [];

    for (const msg of messages) {
      let matched = false;
      for (const def of topicDefs) {
        if (def.keywords.test(msg.content)) {
          matched = true;
          let entry = topicMap.get(def.topic);
          if (!entry) {
            entry = { topic: def.topic, category: def.category, messages: [], count: 0, uniqueContacts: 0 };
            topicMap.set(def.topic, entry);
          }
          entry.messages.push({
            id: msg.id,
            content: msg.content.slice(0, 300),
            contact_name: msg.contact_name,
            contact_id: msg.contact_id,
            created_at: msg.created_at,
          });
          entry.count++;
        }
      }
      if (!matched) uncategorized.push(msg);
    }

    // Compute unique contacts per topic
    for (const entry of topicMap.values()) {
      entry.uniqueContacts = new Set(entry.messages.map((m) => m.contact_id)).size;
    }

    // Sort by count descending
    const topics = [...topicMap.values()]
      .sort((a, b) => b.count - a.count)
      .map((t) => ({
        topic: t.topic,
        category: t.category,
        messageCount: t.count,
        uniqueContacts: t.uniqueContacts,
        sampleMessages: t.messages.slice(0, 5),
      }));

    // Category summaries
    const categories = new Map<string, { count: number; topics: string[] }>();
    for (const t of topics) {
      let cat = categories.get(t.category);
      if (!cat) { cat = { count: 0, topics: [] }; categories.set(t.category, cat); }
      cat.count += t.messageCount;
      cat.topics.push(t.topic);
    }

    return NextResponse.json({
      totalInboundMessages: messages.length,
      categorizedMessages: messages.length - uncategorized.length,
      uncategorizedCount: uncategorized.length,
      categories: Object.fromEntries(categories),
      topics,
      uncategorizedSamples: uncategorized.slice(0, 15).map((m) => ({
        content: m.content.slice(0, 200),
        contact_name: m.contact_name,
        created_at: m.created_at,
      })),
    });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Unknown error" },
      { status: 500 }
    );
  }
}
