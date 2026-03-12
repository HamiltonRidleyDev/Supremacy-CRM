import type { ZivvyContact } from "./types";

/** Parse Zivvy belt rank string (e.g., "White Belt/2 stripe") into { rank, stripes } */
function parseBeltRank(raw: string | null): { rank: string; stripes: number } {
  if (!raw) return { rank: "white", stripes: 0 };

  const lower = raw.toLowerCase();

  // Extract stripe count
  const stripeMatch = lower.match(/(\d+)\s*stripe/);
  const stripes = stripeMatch ? parseInt(stripeMatch[1], 10) : 0;

  // Extract belt color
  if (lower.includes("black")) return { rank: "black", stripes };
  if (lower.includes("brown")) return { rank: "brown", stripes };
  if (lower.includes("purple")) return { rank: "purple", stripes };
  if (lower.includes("blue")) return { rank: "blue", stripes };
  return { rank: "white", stripes };
}

/** Parse Zivvy date strings ("2022-06-08T00:00:00" or "03/02/2026 12:00:00 AM") to ISO date */
function parseDate(raw: string | null): string | null {
  if (!raw) return null;
  try {
    const d = new Date(raw);
    if (isNaN(d.getTime())) return null;
    return d.toISOString().split("T")[0];
  } catch {
    return null;
  }
}

/** Map Zivvy program name to a membership_type for our students table */
function mapMembershipType(program: string | null): string {
  if (!program) return "standard";
  const p = program.toLowerCase();
  if (p.includes("platinum")) return "platinum";
  if (p.includes("gold")) return "gold";
  if (p.includes("silver")) return "silver";
  if (p.includes("bronze")) return "bronze";
  if (p.includes("tiny ninja")) return "tiny_ninja";
  if (p.includes("little ninja")) return "little_ninja";
  if (p.includes("teen")) return "teen";
  if (p.includes("power payment")) return "power_payment";
  return "standard";
}

/** Build parent info string from Zivvy mom/dad fields */
function buildParentInfo(contact: ZivvyContact): string | null {
  const parts: string[] = [];
  if (contact.momFirstName) {
    parts.push(`${contact.momFirstName} ${contact.momLastName || ""}`.trim());
  }
  if (contact.dadFirstName) {
    parts.push(`${contact.dadFirstName} ${contact.dadLastName || ""}`.trim());
  }
  return parts.length > 0 ? parts.join(", ") : null;
}

function buildParentPhone(contact: ZivvyContact): string | null {
  return contact.parentCell1 || contact.parentCell2 || null;
}

/** Map Zivvy lead source to our normalized source values */
function mapLeadSource(source: string | null): string {
  if (!source) return "unknown";
  const s = source.trim().toLowerCase();
  if (s.includes("web")) return "website";
  if (s.includes("google")) return "google";
  if (s.includes("referral")) return "referral";
  if (s.includes("walk")) return "walk-in";
  if (s.includes("drive")) return "walk-in";
  if (s.includes("facebook") || s.includes("instagram")) return "social_media";
  if (s.includes("yelp")) return "yelp";
  return source.trim();
}

/** Data ready to upsert into the students table */
export interface StudentRecord {
  zivvy_id: number;
  first_name: string;
  last_name: string;
  email: string | null;
  phone: string | null;
  belt_rank: string;
  stripes: number;
  membership_type: string;
  membership_status: string;
  monthly_rate: number | null;
  start_date: string;
  last_attendance: string | null;
  notes: string | null;
  age_group: string | null;
  age: number | null;
  address: string | null;
  city: string | null;
  state: string | null;
  zip: string | null;
  parent_name: string | null;
  parent_phone: string | null;
  source: string | null;
  current_program: string | null;
  total_classes: number;
  billing_method: string | null;
  on_vacation: number;
  date_added: string | null;
}

/** Data ready to upsert into the leads table */
export interface LeadRecord {
  zivvy_id: number;
  first_name: string;
  last_name: string | null;
  email: string | null;
  phone: string | null;
  source: string;
  interest: string | null;
  status: string;
  notes: string | null;
}

/** Map a Zivvy student/former contact to our student record */
export function mapToStudent(contact: ZivvyContact, status: "active" | "inactive"): StudentRecord {
  // Note: rank, program name, tuition, attendance counts are NOT in the KendoGrid list response
  // They live in relational sub-objects (ranks, memberships, attendances) which are null in the list view
  // We set defaults and can enrich later if we add individual contact detail fetching
  const address = [contact.address1, contact.address2].filter(Boolean).join(", ") || null;
  const isOnVacation = contact.vacationStart && !contact.vacationReturn ? 1 : 0;

  return {
    zivvy_id: contact.id,
    first_name: contact.firstName,
    last_name: contact.lastName.trim(),
    email: contact.emailAddress,
    phone: contact.mobile || contact.phone,
    belt_rank: "white",  // Not available from list endpoint — default
    stripes: 0,
    membership_type: "standard",  // Not available from list endpoint — default
    membership_status: status,
    monthly_rate: null,  // Not available from list endpoint
    start_date: parseDate(contact.contractSignDate) || parseDate(contact.entered) || new Date().toISOString().split("T")[0],
    last_attendance: null,  // Not available from list endpoint
    notes: null,
    age_group: contact.ageGroup,
    age: contact.age,
    address,
    city: contact.city,
    state: contact.state,
    zip: contact.zip,
    parent_name: buildParentInfo(contact),
    parent_phone: buildParentPhone(contact),
    source: contact.source,
    current_program: null,  // Not available from list endpoint
    total_classes: 0,  // Not available from list endpoint
    billing_method: null,  // Not available from list endpoint
    on_vacation: isOnVacation,
    date_added: parseDate(contact.entered),
  };
}

/** Map a Zivvy prospect to our lead record */
export function mapToLead(contact: ZivvyContact): LeadRecord {
  // Determine lead status from Zivvy's prospect stage
  let status = "new";
  const stage = (contact.prospectStage || "").toLowerCase();
  if (stage.includes("contact") || stage.includes("called")) status = "contacted";
  if (stage.includes("trial") || stage.includes("booked")) status = "trial_booked";
  if (stage.includes("attend")) status = "trial_attended";
  if (stage.includes("sign") || stage.includes("convert")) status = "signed_up";
  if (stage.includes("lost") || stage.includes("dead")) status = "lost";

  // Try to infer interest from program or age group
  let interest: string | null = null;
  const ageGroup = (contact.ageGroup || "").toLowerCase();
  if (ageGroup.includes("tiny") || ageGroup.includes("little")) interest = "kids";
  else if (ageGroup.includes("teen")) interest = "teens";
  else if (ageGroup.includes("adult")) interest = "adult_gi";

  return {
    zivvy_id: contact.id,
    first_name: contact.firstName,
    last_name: contact.lastName,
    email: contact.emailAddress,
    phone: contact.mobile || contact.phone,
    source: mapLeadSource(contact.source),
    interest,
    status,
    notes: contact.sourceDetail || null,
  };
}
