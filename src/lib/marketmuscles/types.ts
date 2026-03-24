// Types for Market Muscles (GoHighLevel) APIs
// Two data sources: Typesense (search/bulk) and CRM API (rich detail + conversations)

// ─── Typesense API Types ───────────────────────────────────────────

/** A single contact document from the Typesense search API */
export interface MMContact {
  id: string; // "con_xxx" format
  first_name: string;
  last_name: string;
  full_name: string;
  email_address: string | null;
  phone_number: string | null;
  country: string;
  type: string; // "Lead", "Contact"
  type_id: string;
  status: string; // "New"
  status_id: string;
  source: string; // "Website"
  source_id: string;
  tags: string[];
  referrer: {
    medium?: string;
    source?: string;
    source_domain?: string;
    utm?: Record<string, string>;
  } | null;
  optin_email: boolean;
  optin_sms: boolean;
  is_spam: boolean;
  location_id: string;
  team_id: string;
  url: string;
  created_at: number;
  created_at_iso: string;
  lead_at: number | null;
  last_optin_at: number | null;
  current_ranks: unknown[];
  rosters: unknown[];
  metas: unknown[];
}

/** Typesense search response wrapper */
export interface TypesenseSearchResponse {
  found: number;
  hits: Array<{
    document: MMContact;
    highlights: unknown[];
    text_match: number;
  }>;
  page: number;
  request_params: { per_page: number };
  search_time_ms: number;
  facet_counts?: Array<{
    field_name: string;
    counts: Array<{ value: string; count: number }>;
  }>;
}

// ─── CRM API Types ─────────────────────────────────────────────────

/** Contact detail from CRM API (richer than Typesense) */
export interface CRMContactDetail {
  id: string;
  team_id: string;
  location_id: string;
  first_name: string;
  last_name: string;
  full_name: string;
  email_address: string | null;
  phone_number: string | null;
  text_thread_id: string | null;
  type_id: string;
  type: { id: string; label: string; value: string };
  status_id: string;
  status: { id: string; label: string; value: string };
  source_id: string;
  source: { id: string; label: string; value: string };
  tags: Array<{ id: string; name: string; slug: string; folder_id: string | null }>;
  opted_in_email: boolean;
  opted_in_sms: boolean;
  address: string | null;
  dob: string | null;
  gender: string | null;
  photo_url: string | null;
  stripe_customer_id: string | null;
  location_name: string;
  created_at: string;
}

/** A conversation thread from /messages endpoint */
export interface CRMConversationThread {
  roomId: string; // thread_xxx
  roomName: string; // contact display name
  avatar: string;
  contact: { _id: string; username: string };
  users: Array<{ _id: string; username: string }>;
  lastMessage: CRMLastMessage | null;
  unreadCount: number;
  metadata: { is_archived: boolean };
}

/** An individual SMS/chat message from /messages/{threadId} (chat-room format) */
export interface CRMMessage {
  _id: string; // sms_xxx
  roomId: string; // thread_xxx
  content: string;
  senderId: string; // con_xxx for contact, auth_xxx or loc_xxx for gym
  username: string | null;
  date: string; // formatted date "3/10/26"
  timestamp: string; // formatted "3/10/26 10:59 AM"
  seen: boolean;
  deleted: boolean;
  failure: boolean;
  failureMessage: string | null;
  system: boolean;
  files: unknown[];
  metadata: {
    is_automation: boolean;
    is_review_request: boolean;
    sourceable: {
      id: string;
      name: string;
    } | null;
  };
}

/** The lastMessage object within a thread (full SMS format) */
export interface CRMLastMessage {
  id: string;
  twilio_sid: string | null;
  text_thread_id: string;
  contact_id: string;
  sender_id: string;
  direction: string; // "inbound", "outbound"
  content: string;
  source: string; // "direct", "workflow"
  status: string;
  created_at: string;
  delivered_at: string | null;
  read_at: string | null;
  is_review_request: boolean;
  sourceable?: {
    id: string;
    name: string;
  } | null;
}

/** Paginated CRM API response */
export interface CRMPaginatedResponse<T> {
  data: T[];
  links: Array<{ url: string | null; label: string; active: boolean }>;
  meta: {
    current_page: number;
    first_page_url: string;
    from: number;
    last_page: number;
    last_page_url: string;
    next_page_url: string | null;
    path: string;
    per_page: number;
    prev_page_url: string | null;
    to: number;
    total: number;
  };
}

// ─── Sync Result Types ─────────────────────────────────────────────

/** Full sync result (contacts + conversations) */
export interface MMSyncResult {
  status: "success" | "error";
  contacts_synced: number;
  leads_created: number;
  leads_updated: number;
  matched_existing: number;
  conversations_synced: number;
  messages_synced: number;
  duration_ms: number;
  error?: string;
  warning?: string;
}

/** Sync log entry */
export interface MMSyncLogEntry {
  id: number;
  started_at: string;
  completed_at: string | null;
  status: string;
  contacts_synced: number;
  leads_created: number;
  leads_updated: number;
  matched_existing: number;
  conversations_synced: number;
  messages_synced: number;
  error_message: string | null;
}
