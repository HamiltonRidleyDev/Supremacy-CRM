// Types for the Zivvy (RainMaker) coreapi.addmembers.com API

/** Raw response from KendoGrid endpoint (lowercase keys) */
export interface ZivvyGridResponse {
  data: ZivvyContact[];
  total: number;
  aggregateResults: unknown;
  errors: unknown;
}

/**
 * A single contact record from the KendoGrid API.
 * Based on actual API response (83 fields, camelCase).
 * Note: relational fields (ranks, memberships, attendances) come back as null
 * in the list endpoint — rank/program/tuition/attendance data is NOT available
 * from KendoGrid. We map what we can from the flat fields.
 */
export interface ZivvyContact {
  id: number;
  schoolId: number;
  contactType: string; // S=Student, P=Prospect, F=Former, C=Staff
  mappedContactType: string;
  active: boolean;
  firstName: string;
  lastName: string;
  fullName: string;
  emailAddress: string | null;
  emailAddress2: string | null;
  emailAddress3: string | null;
  emailSubscribe: boolean;
  emailUnsubscribedDate: string | null;
  phone: string | null;
  mobile: string | null;
  smsSubscribe: boolean;
  address1: string | null;
  address2: string | null;
  city: string | null;
  state: string | null;
  zip: string | null;
  dateOfBirth: string | null;
  age: number | null;
  ageGroup: string | null;
  birthMonthDay: number | null;

  // Parent/Guardian
  momFirstName: string | null;
  momLastName: string | null;
  dadFirstName: string | null;
  dadLastName: string | null;
  parentCell1: string | null;
  parentCell2: string | null;
  parentFullName1: string | null;
  parentFullName2: string | null;

  // Lead source & dates
  source: string | null;
  sourceDetail: string | null;
  dateLeadCollected: string | null;
  entered: string | null;
  contractSignDate: string | null;

  // Program (expires only — name/details are in the null `memberships` relation)
  currentProgramExpires: string | null;
  onTrial: boolean;
  trialStartDate: string | null;
  trialStatusActive: boolean;

  // Attendance (classCreditsRemaining is available, but totals/lastAttend are NOT)
  classCreditsRemaining: number | null;

  // Billing (only hold reason available from list endpoint)
  paymentsOnHoldReason: string | null;

  // Prospect pipeline
  prospectStage: string | null;
  quitDate: string | null;
  upgradePhase: string | null;

  // Vacation
  vacationStart: string | null;
  vacationReturn: string | null;

  // Other
  referredBy: string | null;
  whoReferred: string | null;
  whoReferredName: string | null;
  benefits: string | null;
  primaryBenefit: string | null;
  secondaryBenefit: string | null;
  picturePath: string | null;
  alternateId: string | null;
  facebookUrl: string | null;
  needToSee: string | null;
  needToSeeWhy: string | null;
  geoLatitude: number;
  geoLongitude: number;

  // Relational (always null in list endpoint)
  ranks: unknown;
  memberships: unknown;
  attendances: unknown;
  appointments: unknown;
  invoices: unknown;
  tags: unknown;
  flowTags: unknown;
  files: unknown;
  staticLists: unknown;
  contactTypeChanges: unknown;
  nextTestDates: unknown;
  lessonRosters: unknown;
  webLead: unknown;
  profitGeneratorRegistrations: unknown;
  myMembersiteLogins: unknown;
  emailStatus: unknown;

  // Catch-all
  [key: string]: unknown;
}

/** Sync run status */
export type SyncStatus = "idle" | "running" | "success" | "error";

/** Sync log entry */
export interface SyncLogEntry {
  id: number;
  started_at: string;
  completed_at: string | null;
  status: SyncStatus;
  students_synced: number;
  leads_synced: number;
  former_synced: number;
  total_contacts: number;
  error_message: string | null;
}

/** Sync result returned to the client */
export interface SyncResult {
  status: SyncStatus;
  students_synced: number;
  leads_synced: number;
  former_synced: number;
  total_contacts: number;
  duration_ms: number;
  error?: string;
}
