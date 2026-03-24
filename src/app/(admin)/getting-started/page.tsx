"use client";

import { useState } from "react";
import Link from "next/link";

// ---------------------------------------------------------------------------
// Persona Workflows
// ---------------------------------------------------------------------------

interface Workflow {
  id: string;
  title: string;
  subtitle: string;
  icon: React.ReactNode;
  color: string;
  steps: Array<{
    page: string;
    href: string;
    action: string;
    detail: string;
  }>;
}

const workflows: Workflow[] = [
  {
    id: "churn",
    title: "Reduce Churn & Save Revenue",
    subtitle: "Keep paying members engaged before they quit",
    color: "text-red-400",
    icon: (
      <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z" />
      </svg>
    ),
    steps: [
      {
        page: "Daily Briefing",
        href: "/briefing",
        action: "Start your day here",
        detail: "See who needs attention, revenue at risk, and pending follow-ups — all on one screen.",
      },
      {
        page: "Dashboard > Attention Tab",
        href: "/?tab=attention",
        action: "Review the risk distribution",
        detail: "The stacked bar shows healthy vs cooling vs at-risk vs ghost members. The table below lists the highest-revenue members who need outreach.",
      },
      {
        page: "Students",
        href: "/students",
        action: "Sort by engagement score or risk level",
        detail: "Use the 'At Risk' and 'Ghost' filter buttons to see only members who need help. Click any row to see their full profile, attendance trends, and conversation history.",
      },
      {
        page: "Re-engagement",
        href: "/re-engagement",
        action: "AI-draft personal check-in messages",
        detail: "See all at-risk, ghost, and cooling active members sorted by urgency. Tap any member to have AI draft a personalized text or email in Rodrigo's voice. Choose tone (casual, warm, concerned) and review before sending. The system tracks prior outreach to avoid nagging.",
      },
      {
        page: "Dashboard > Win-Back Tab",
        href: "/?tab=winback",
        action: "Win back former members",
        detail: "For members who already cancelled: AI-generated messages grouped by household so you send one message per parent, not one per kid. Approve, edit, or dismiss.",
      },
      {
        page: "Student Detail > Conversations",
        href: "/students",
        action: "Check message history before calling",
        detail: "See what was already sent (automated or manual) so you don't repeat yourself. The AI re-engagement and win-back prompts use this context too.",
      },
    ],
  },
  {
    id: "leads",
    title: "Generate & Convert Leads",
    subtitle: "Fill the pipeline with organic content and follow through",
    color: "text-accent",
    icon: (
      <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15 10.5a3 3 0 11-6 0 3 3 0 016 0z" />
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M19.5 10.5c0 7.142-7.5 11.25-7.5 11.25S4.5 17.642 4.5 10.5a7.5 7.5 0 1115 0z" />
      </svg>
    ),
    steps: [
      {
        page: "Content Studio",
        href: "/content",
        action: "Generate marketing content",
        detail: "Create social posts, Google Business updates, blog snippets, competitor capture emails, and more — all in Rodrigo's authentic voice using the learned instructor profile.",
      },
      {
        page: "Content Studio > Queue",
        href: "/content",
        action: "Review, revise, and approve",
        detail: "Content goes through a pipeline: draft > revision > approved > published. Tell the AI to revise conversationally ('make it shorter', 'mention the kids program'). Copy approved content to your social platforms.",
      },
      {
        page: "Leads / CRM > Pipeline",
        href: "/leads",
        action: "Track prospects through the funnel",
        detail: "Kanban view shows prospects from 'New' through 'Signed Up'. Synced from Zivvy — every new inquiry shows up automatically.",
      },
      {
        page: "Leads / CRM > Funnel",
        href: "/leads",
        action: "Measure conversion rates",
        detail: "Monthly breakdown: how many leads came in, how many converted, where they dropped off. Helps you know if lead quality or follow-through is the bottleneck.",
      },
      {
        page: "Surveys",
        href: "/surveys",
        action: "Collect prospect info",
        detail: "Send surveys to leads or new members to learn their goals, schedule preferences, and how they heard about you. Data feeds into the student profile.",
      },
    ],
  },
  {
    id: "curriculum",
    title: "Build Curriculum & Brand",
    subtitle: "Plan lessons, track technique coverage, create teaching content",
    color: "text-purple-400",
    icon: (
      <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4.26 10.147a60.436 60.436 0 00-.491 6.347A48.627 48.627 0 0112 20.904a48.627 48.627 0 018.232-4.41 60.46 60.46 0 00-.491-6.347m-15.482 0a50.57 50.57 0 00-2.658-.813A59.905 59.905 0 0112 3.493a59.902 59.902 0 0110.399 5.84c-.896.248-1.783.52-2.658.814m-15.482 0A50.697 50.697 0 0112 13.489a50.702 50.702 0 017.74-3.342M6.75 15a.75.75 0 100-1.5.75.75 0 000 1.5zm0 0v-3.675A55.378 55.378 0 0112 8.443m-7.007 11.55A5.981 5.981 0 006.75 15.75v-1.5" />
      </svg>
    ),
    steps: [
      {
        page: "Mat Planner",
        href: "/planner",
        action: "Plan lessons through conversation",
        detail: "Talk through what you want to teach — the AI helps structure warmup, techniques, drilling, and sparring. It learns your teaching style over time through the instructor profile.",
      },
      {
        page: "Curriculum",
        href: "/curriculum",
        action: "Track technique coverage & gaps",
        detail: "See which techniques are fresh, aging, stale, or never taught. Filter by category and belt level. Identify gaps in your curriculum before students notice.",
      },
      {
        page: "Schedule",
        href: "/schedule",
        action: "See lessons on the weekly calendar",
        detail: "Lesson plans automatically map to scheduled class slots. See at a glance what's planned for each class this week.",
      },
      {
        page: "Student Detail > Knowledge Map",
        href: "/students",
        action: "See what each student has been exposed to",
        detail: "For any student, see which techniques they've seen in class and which they've missed. Identifies private lesson opportunities for belt-appropriate gaps.",
      },
      {
        page: "Content Studio",
        href: "/content",
        action: "Turn lessons into social content",
        detail: "Use lesson topics as source material for social posts, blog snippets, or video scripts. The AI knows your teaching style and can generate content that sounds like you.",
      },
      {
        page: "Quick Notes",
        href: "/notes",
        action: "Capture ideas on the go",
        detail: "Tap the big mic button to voice-record lesson ideas, technique variations, or student observations. Review and save with tags. Notes feed into Mat Planner. In Quick Assistant, say 'pin that' to save AI responses as notes.",
      },
    ],
  },
  {
    id: "mobile",
    title: "Mobile Setup & Quick Access",
    subtitle: "Install the app on your phone and set up voice-first access",
    color: "text-emerald-400",
    icon: (
      <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M10.5 1.5H8.25A2.25 2.25 0 006 3.75v16.5a2.25 2.25 0 002.25 2.25h7.5A2.25 2.25 0 0018 20.25V3.75a2.25 2.25 0 00-2.25-2.25H13.5m-3 0V3h3V1.5m-3 0h3m-3 18.75h3" />
      </svg>
    ),
    steps: [
      {
        page: "Install the App",
        href: "/",
        action: "Add Supremacy to your home screen",
        detail: "On Android: Open the app in Chrome > tap the three-dot menu (top right) > 'Add to Home Screen' or 'Install app'. On iPhone: Open in Safari > tap the Share button > 'Add to Home Screen'. This creates a full-screen app experience — no browser bar.",
      },
      {
        page: "Sidebar > Quick Start Toggle",
        href: "/",
        action: "Enable Quick Start mode",
        detail: "Open the sidebar (tap the menu icon) and scroll to the bottom. Toggle 'Quick Start' ON. Now every time you open the app, you'll land on a voice-first screen with a big mic button — ready to talk immediately.",
      },
      {
        page: "Quick Start Overlay",
        href: "/",
        action: "Talk to the AI assistant on launch",
        detail: "With Quick Start enabled, open the app and tap the mic. Ask anything: 'How are we doing this month?', 'Who's at risk?', 'What should I focus on today?' The AI has full context on your gym data — members, revenue, trends, leads. Save any response as a note with one tap.",
      },
      {
        page: "Quick Notes",
        href: "/notes",
        action: "Capture ideas between classes",
        detail: "Use Quick Start or the Quick Notes page to voice-record thoughts, lesson ideas, student observations, or business ideas. Notes are saved with timestamps and tags. They can feed into the Mat Planner as context for future lesson plans.",
      },
      {
        page: "Quick Assistant",
        href: "/quick",
        action: "Full voice assistant for staff",
        detail: "The /quick page is a dedicated voice assistant with a Notes tab. Say 'save that' or 'pin that' to bookmark important AI responses. Access from the sidebar under Daily Ops > Quick Assistant.",
      },
    ],
  },
  {
    id: "operations",
    title: "Daily Gym Operations",
    subtitle: "Stay on top of the day-to-day without digging through multiple systems",
    color: "text-yellow-400",
    icon: (
      <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 3v2.25m6.364.386l-1.591 1.591M21 12h-2.25m-.386 6.364l-1.591-1.591M12 18.75V21m-4.773-4.227l-1.591 1.591M5.25 12H3m4.227-4.773L5.636 5.636M15.75 12a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0z" />
      </svg>
    ),
    steps: [
      {
        page: "Daily Briefing",
        href: "/briefing",
        action: "One-screen daily overview",
        detail: "Who needs attention, new leads, unread messages, pending content, upcoming classes. Quick-action buttons at the bottom to jump to common tasks.",
      },
      {
        page: "Dashboard",
        href: "/",
        action: "Business metrics and KPIs",
        detail: "Strategic KPIs, enrollment vs churn trends, conversion rates, revenue targets, geographic reach, and AI-generated business insights.",
      },
      {
        page: "Community",
        href: "/community",
        action: "Internal messaging",
        detail: "Announcement channels, group chats, and DMs. Post updates for members or staff. Channels auto-join based on membership type.",
      },
      {
        page: "Users & Roles",
        href: "/users",
        action: "Manage staff access",
        detail: "Assign roles (admin, manager, member, guest) that control what each person can see and do in the app.",
      },
    ],
  },
];

// ---------------------------------------------------------------------------
// Page Directory
// ---------------------------------------------------------------------------

interface PageInfo {
  name: string;
  href: string;
  description: string;
  dataSource: string;
  bestFor: string[];
}

const pages: PageInfo[] = [
  {
    name: "Daily Briefing",
    href: "/briefing",
    description: "Single-screen morning overview. Shows at-risk members, new leads, unread messages, pending content and win-backs, and recent classes. Quick-action buttons at the bottom.",
    dataSource: "Combined from Dashboard, Contacts, Market Muscles, Content Studio",
    bestFor: ["Rodrigo (daily check-in)", "Kyle (front desk morning prep)"],
  },
  {
    name: "Dashboard",
    href: "/",
    description: "Business intelligence hub with tabbed sections: Attention (at-risk members), KPIs (enrollment/churn/conversion trends), Revenue Targets, AI Insights, Win-Back, Snapshot (geography, demographics), Pipeline, and Data Gaps.",
    dataSource: "Zivvy (members, payments), Market Muscles (leads, conversations), our engagement scoring",
    bestFor: ["Strategic planning", "Monthly reviews", "Identifying trends"],
  },
  {
    name: "Mat Planner",
    href: "/planner",
    description: "AI-powered lesson planning through conversation. Talk about what you want to teach and the AI structures it into warmup, techniques, drilling, and sparring. Learns your teaching style over time. View your instructor profile and past session history.",
    dataSource: "Claude AI + instructor insights learned from conversations",
    bestFor: ["Rodrigo (lesson planning)", "Any instructor planning classes"],
  },
  {
    name: "Students",
    href: "/students",
    description: "Sortable member list with engagement scores, risk levels, cost-per-class, attendance, belt rank, and household info. Filter by status or risk level. Click any row for full detail.",
    dataSource: "Zivvy (membership, attendance, payments) + our engagement scoring",
    bestFor: ["Finding at-risk members", "Reviewing the roster", "Checking who's training"],
  },
  {
    name: "Student Detail",
    href: "/students",
    description: "Deep dive on any member: engagement breakdown (5 scores), attendance trend chart, payment history, student profile (goals, motivation, injuries), household members, conversation history, and knowledge map.",
    dataSource: "All systems combined — Zivvy, Market Muscles, our profiles and scoring",
    bestFor: ["Before calling a member", "Private lesson planning", "Understanding why someone left"],
  },
  {
    name: "Re-engagement",
    href: "/re-engagement",
    description: "AI-powered check-in messages for active members who stopped showing up. See ghost, at-risk, and cooling members sorted by revenue impact. Generate personalized texts or emails, review in the approval queue, edit if needed, then approve and send. Tracks prior outreach to prevent nagging.",
    dataSource: "Contacts engagement scoring + Claude AI + instructor voice profile + conversation history",
    bestFor: ["Rodrigo (daily retention check)", "Saving at-risk revenue", "Proactive outreach"],
  },
  {
    name: "Curriculum",
    href: "/curriculum",
    description: "Technique coverage tracker showing what's been taught recently, what's aging, and what's never been covered. Filterable by category and freshness.",
    dataSource: "Lesson plans + technique library",
    bestFor: ["Curriculum planning", "Finding teaching gaps", "Belt test prep"],
  },
  {
    name: "Leads / CRM",
    href: "/leads",
    description: "Three views: Pipeline (kanban board), Table (sortable list), and Funnel (monthly conversion analysis). Tracks prospects from first contact through sign-up.",
    dataSource: "Zivvy (prospects)",
    bestFor: ["Tracking follow-ups", "Measuring lead conversion", "Pipeline management"],
  },
  {
    name: "Content Studio",
    href: "/content",
    description: "AI content generation with approval workflow. Create social posts, Google Business updates, blog snippets, lead emails, website copy, and competitor capture content. Conversational revision ('make it shorter'). Image prompt generation for photo direction.",
    dataSource: "Claude AI + instructor profile",
    bestFor: ["Marketing content creation", "Social media", "Kyle (posting content)"],
  },
  {
    name: "Surveys",
    href: "/surveys",
    description: "Create survey templates, send to bulk recipients via SMS/email/link, and collect responses. Templates target students or leads with custom questions.",
    dataSource: "Our survey system",
    bestFor: ["New member onboarding", "Exit interviews", "Collecting preferences"],
  },
  {
    name: "Quick Start (Voice Overlay)",
    href: "/",
    description: "Voice-first screen that appears when you open the app (if enabled in sidebar settings). Big mic button, full AI chat with gym data context, and one-tap save-to-notes. Designed for capturing ideas or asking questions the moment you open the app.",
    dataSource: "Claude AI + all gym data (same as Dashboard Chat)",
    bestFor: ["Rodrigo (voice-first workflow)", "Quick questions on the go", "Capturing ideas before you forget"],
  },
  {
    name: "Quick Notes",
    href: "/notes",
    description: "Mobile-first voice capture for ideas, observations, and lesson concepts. Big mic button — tap to record, tap again to stop, then save. Notes feed into Mat Planner as context. In the Quick Assistant, say 'pin that' to save AI responses as notes.",
    dataSource: "Our notes system",
    bestFor: ["Rodrigo (capturing ideas between classes)", "Post-class observations", "Driving-time ideas"],
  },
  {
    name: "Community",
    href: "/community",
    description: "Internal messaging with channels (public, announcement, private, DM). Announcement channels are read-only for members. Unread badges.",
    dataSource: "Our messaging system",
    bestFor: ["Staff communication", "Member announcements", "Team coordination"],
  },
  {
    name: "Users & Roles",
    href: "/users",
    description: "Manage who has access and what they can do. Roles: Admin (full access), Manager (most features), Member (personal dashboard only), Guest (limited view).",
    dataSource: "Our auth system",
    bestFor: ["Onboarding staff", "Managing permissions"],
  },
];

// ---------------------------------------------------------------------------
// Metric Glossary
// ---------------------------------------------------------------------------

interface MetricDef {
  name: string;
  definition: string;
  calculation: string;
  goodBad: string;
  whereToFind: string;
}

const metrics: MetricDef[] = [
  {
    name: "Engagement Score",
    definition: "A 0-100 composite score measuring how connected a member is to the gym across five dimensions.",
    calculation: "Attendance (40%) + Communication (20%) + Progression (20%) + Community (10%) + Financial (10%). Each component is scored 0-100 independently.",
    goodBad: "70+ is healthy (green). 40-69 is cooling (yellow). Below 40 is at-risk (red). Below 20 is ghost territory.",
    whereToFind: "Students list, Student detail, Dashboard Attention tab, Daily Briefing",
  },
  {
    name: "Risk Level",
    definition: "A categorical label derived from the engagement score indicating how urgently a member needs outreach.",
    calculation: "Healthy (score 80+), Cooling (60-79), At Risk (40-59), Ghost (20-39), Churned (<20 or inactive).",
    goodBad: "Healthy = no action needed. Cooling = monitor. At Risk = reach out soon. Ghost = urgent outreach or accept the loss.",
    whereToFind: "Students list (filterable), Student detail, Dashboard Attention tab",
  },
  {
    name: "Cost Per Class",
    definition: "How much money a member has paid per class attended. Higher = they're paying but not using the service (churn signal).",
    calculation: "Total amount collected (lifetime payments) / total classes attended.",
    goodBad: "Under $25/class is healthy. Over $25 means they're overpaying relative to attendance — at risk of feeling it's not worth it.",
    whereToFind: "Students list, Student detail, Win-Back cards",
  },
  {
    name: "LTV (Lifetime Value)",
    definition: "Total money collected from a member across their entire membership. Uses actual payment records, not estimates.",
    calculation: "Sum of all approved AutoCollect transactions from Zivvy. Falls back to monthly_rate x months active if payment data isn't synced yet.",
    goodBad: "Higher is more invested — but also means more revenue lost if they churn. A $5,000 LTV ghost member is a much bigger deal than a $200 one.",
    whereToFind: "Students list, Student detail, Win-Back cards (household LTV)",
  },
  {
    name: "Cost Trend (Sparkline)",
    definition: "A mini chart showing monthly cost-per-class over time. When the line goes up, the member is paying more per class (attending less).",
    calculation: "Monthly payments / monthly attendance for the last 12 months. Compares the last 3 months average to the prior 3 months.",
    goodBad: "Flat or declining = good (maintaining or improving attendance). Rising = bad (attendance dropping while still paying).",
    whereToFind: "Win-Back cards",
  },
  {
    name: "Revenue at Risk",
    definition: "Total monthly revenue from members currently classified as At Risk or Ghost. This is money that could disappear if they cancel.",
    calculation: "Sum of monthly_rate for all active members with risk_level in (at_risk, ghost).",
    goodBad: "Any amount > $0 deserves attention. This is the dollar case for proactive outreach.",
    whereToFind: "Dashboard Attention tab, Daily Briefing",
  },
  {
    name: "Conversion Rate",
    definition: "The percentage of leads (prospects) who eventually sign up as paying members.",
    calculation: "Members who signed up / total leads in the same time period. Shown monthly on the KPIs tab and the Leads funnel view.",
    goodBad: "Industry benchmark for BJJ is 3-5%. Above 5% is excellent. Below 2% means leads aren't being followed up or trial experience needs work.",
    whereToFind: "Dashboard KPIs tab, Leads Funnel view",
  },
  {
    name: "Net Growth",
    definition: "New enrollments minus cancellations per month. The single most important number for gym health.",
    calculation: "New students enrolled this month - members who went inactive this month.",
    goodBad: "Positive = growing. Zero = treading water. Negative = shrinking. Aim for +5 to +10/month to reach 300-member goal.",
    whereToFind: "Dashboard KPIs tab (Enrollments vs Churn chart)",
  },
  {
    name: "Knowledge Map Coverage",
    definition: "What percentage of the curriculum's techniques a student has been exposed to through class attendance.",
    calculation: "Unique techniques seen in attended classes / total techniques in curriculum.",
    goodBad: "Higher is better. Gaps identify private lesson opportunities. Coverage naturally increases with tenure.",
    whereToFind: "Student detail > Knowledge Map tab",
  },
  {
    name: "Attendance Score",
    definition: "The attendance component of the engagement score. Measures how regularly a member trains.",
    calculation: "Based on frequency (classes per 30 days vs their target), trend (recent vs prior 14 days), and consistency (weekly standard deviation over 8 weeks).",
    goodBad: "100 = training at or above target consistently. 50 = training about half as much as they should. 0 = hasn't trained in months.",
    whereToFind: "Student detail > Overview tab (Engagement Breakdown)",
  },
];

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

type Tab = "workflows" | "pages" | "metrics";

export default function GettingStartedPage() {
  const [activeTab, setActiveTab] = useState<Tab>("workflows");
  const [expandedWorkflow, setExpandedWorkflow] = useState<string | null>("churn");

  return (
    <div className="max-w-5xl">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-2xl font-bold">Getting Started</h1>
        <p className="text-sm text-muted mt-1">
          Learn how to use the app based on what you're trying to accomplish
        </p>
      </div>

      {/* Tab Bar */}
      <div className="flex gap-2 mb-6 border-b border-border pb-3">
        {([
          { key: "workflows" as Tab, label: "What Do You Want To Do?" },
          { key: "pages" as Tab, label: "Page Directory" },
          { key: "metrics" as Tab, label: "Metric Glossary" },
        ]).map(({ key, label }) => (
          <button
            key={key}
            onClick={() => setActiveTab(key)}
            className={`px-4 py-2 text-sm font-medium rounded-lg transition-colors ${
              activeTab === key
                ? "bg-accent/15 text-accent"
                : "text-muted hover:text-foreground hover:bg-card-hover"
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {/* WORKFLOWS TAB */}
      {activeTab === "workflows" && (
        <div className="space-y-4">
          <p className="text-sm text-muted mb-4">
            Pick what you're focused on and we'll show you exactly where to go and what to do.
          </p>
          {workflows.map((wf) => {
            const isExpanded = expandedWorkflow === wf.id;
            return (
              <div
                key={wf.id}
                className={`bg-card rounded-xl border transition-colors ${
                  isExpanded ? "border-accent/40" : "border-border"
                }`}
              >
                <button
                  onClick={() => setExpandedWorkflow(isExpanded ? null : wf.id)}
                  className="w-full px-5 py-4 flex items-center gap-4 text-left"
                >
                  <div className={`flex-shrink-0 ${wf.color}`}>{wf.icon}</div>
                  <div className="flex-1 min-w-0">
                    <p className={`text-sm font-semibold ${wf.color}`}>{wf.title}</p>
                    <p className="text-xs text-muted mt-0.5">{wf.subtitle}</p>
                  </div>
                  <svg
                    className={`w-4 h-4 text-muted flex-shrink-0 transition-transform ${isExpanded ? "rotate-180" : ""}`}
                    fill="none" stroke="currentColor" viewBox="0 0 24 24"
                  >
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                  </svg>
                </button>

                {isExpanded && (
                  <div className="px-5 pb-5 border-t border-border">
                    <div className="mt-4 space-y-0">
                      {wf.steps.map((step, i) => (
                        <div key={i} className="flex gap-4 relative">
                          {/* Step number + connector line */}
                          <div className="flex flex-col items-center flex-shrink-0">
                            <div className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold border ${
                              i === 0 ? "border-accent bg-accent/15 text-accent" : "border-border bg-card text-muted"
                            }`}>
                              {i + 1}
                            </div>
                            {i < wf.steps.length - 1 && (
                              <div className="w-px flex-1 bg-border my-1" />
                            )}
                          </div>

                          {/* Step content */}
                          <div className="pb-4 flex-1 min-w-0">
                            <div className="flex items-center gap-2 mb-1">
                              <Link
                                href={step.href}
                                className="text-sm font-medium text-accent hover:underline"
                              >
                                {step.page}
                              </Link>
                            </div>
                            <p className="text-sm font-medium">{step.action}</p>
                            <p className="text-xs text-muted mt-0.5 leading-relaxed">{step.detail}</p>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* PAGES TAB */}
      {activeTab === "pages" && (
        <div className="space-y-3">
          <p className="text-sm text-muted mb-4">
            Every page in the app, what it does, and where its data comes from.
          </p>
          {pages.map((p) => (
            <div key={p.name} className="bg-card rounded-xl border border-border p-5">
              <div className="flex items-start justify-between mb-2">
                <Link href={p.href} className="text-sm font-semibold text-accent hover:underline">
                  {p.name}
                </Link>
              </div>
              <p className="text-sm text-foreground/90 leading-relaxed">{p.description}</p>
              <div className="mt-3 flex flex-wrap gap-x-6 gap-y-1 text-[11px]">
                <span className="text-muted">
                  <span className="font-medium text-foreground/70">Data:</span> {p.dataSource}
                </span>
              </div>
              <div className="mt-2 flex flex-wrap gap-1.5">
                {p.bestFor.map((tag) => (
                  <span key={tag} className="text-[10px] px-2 py-0.5 rounded-full bg-foreground/5 text-muted border border-border">
                    {tag}
                  </span>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* METRICS TAB */}
      {activeTab === "metrics" && (
        <div className="space-y-3">
          <p className="text-sm text-muted mb-4">
            What every number means, how it's calculated, and what to do about it.
          </p>
          {metrics.map((m) => (
            <MetricCard key={m.name} metric={m} />
          ))}
        </div>
      )}
    </div>
  );
}

function MetricCard({ metric }: { metric: MetricDef }) {
  const [expanded, setExpanded] = useState(false);

  return (
    <div className="bg-card rounded-xl border border-border overflow-hidden">
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full px-5 py-3.5 flex items-center justify-between text-left"
      >
        <div>
          <p className="text-sm font-semibold">{metric.name}</p>
          <p className="text-xs text-muted mt-0.5">{metric.definition}</p>
        </div>
        <svg
          className={`w-4 h-4 text-muted flex-shrink-0 transition-transform ml-3 ${expanded ? "rotate-180" : ""}`}
          fill="none" stroke="currentColor" viewBox="0 0 24 24"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {expanded && (
        <div className="px-5 pb-4 border-t border-border pt-3 space-y-3">
          <div>
            <p className="text-[10px] text-muted uppercase tracking-wider font-medium mb-1">How it's calculated</p>
            <p className="text-xs text-foreground/90 leading-relaxed">{metric.calculation}</p>
          </div>
          <div>
            <p className="text-[10px] text-muted uppercase tracking-wider font-medium mb-1">What's good vs bad</p>
            <p className="text-xs text-foreground/90 leading-relaxed">{metric.goodBad}</p>
          </div>
          <div>
            <p className="text-[10px] text-muted uppercase tracking-wider font-medium mb-1">Where to find it</p>
            <p className="text-xs text-foreground/90 leading-relaxed">{metric.whereToFind}</p>
          </div>
        </div>
      )}
    </div>
  );
}
