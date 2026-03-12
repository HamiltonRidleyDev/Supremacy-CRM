// ---- Contact Graph Types ----

export type ContactType =
  | "active_member"
  | "inactive_member"
  | "former_member"
  | "prospect"
  | "lead_only";

export type RiskLevel =
  | "healthy"
  | "cooling"
  | "at_risk"
  | "ghost"
  | "churned";

export interface Contact {
  id: number;
  first_name: string;
  last_name: string;
  email: string | null;
  phone: string | null;
  student_id: number | null;
  lead_id: number | null;
  zivvy_id: number | null;
  mm_id: string | null;
  contact_type: ContactType;
  engagement_score: number | null;
  score_attendance: number | null;
  score_communication: number | null;
  score_progression: number | null;
  score_community: number | null;
  score_financial: number | null;
  risk_level: RiskLevel | null;
  risk_factors: string | null; // JSON array
  monthly_revenue: number | null;
  scored_at: string | null;
  source: string | null;
  age_group: string | null;
  created_at: string;
  updated_at: string;
}

export interface ContactListItem extends Contact {
  household_size: number;
  household_revenue: number;
}

export interface HouseholdLink {
  id: number;
  parent_contact_id: number;
  child_contact_id: number;
  relationship: "parent_child" | "sibling" | "spouse";
  confidence: "inferred" | "confirmed";
  detected_by: string | null;
  created_at: string;
}

export interface HouseholdMember {
  contact_id: number;
  first_name: string;
  last_name: string;
  relationship: string;
  contact_type: ContactType;
  engagement_score: number | null;
  monthly_revenue: number | null;
}

export interface EngagementComponents {
  attendance: { score: number; details: string };
  communication: { score: number; details: string };
  progression: { score: number; details: string };
  community: { score: number; details: string };
  financial: { score: number; details: string };
}

export interface EngagementResult {
  score: number;
  components: EngagementComponents;
  risk_level: RiskLevel;
  risk_factors: string[];
}

export interface PopulateResult {
  contacts_created: number;
  leads_linked: number;
  households_detected: number;
  duration_ms: number;
}

export interface ScoreResult {
  contacts_scored: number;
  distribution: Record<RiskLevel, number>;
  avg_score: number;
  duration_ms: number;
}
