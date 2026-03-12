import type {
  MMContact,
  TypesenseSearchResponse,
  CRMConversationThread,
  CRMMessage,
  CRMPaginatedResponse,
} from "./types";

// ─── Typesense Client (bulk contact search) ───────────────────────

const TYPESENSE_HOST = "https://typesense.marketmuscles.com";
const COLLECTION = "contacts";
const PER_PAGE = 250;

function getTypesenseKey(): string {
  const key = process.env.MM_TYPESENSE_API_KEY;
  if (!key) throw new Error("MM_TYPESENSE_API_KEY not set in environment");
  return key;
}

async function fetchTypesensePage(
  page: number,
  perPage: number = PER_PAGE
): Promise<TypesenseSearchResponse> {
  const params = new URLSearchParams({
    q: "*",
    sort_by: "created_at:desc",
    page: String(page),
    per_page: String(perPage),
    "x-typesense-api-key": getTypesenseKey(),
  });

  const url = `${TYPESENSE_HOST}/collections/${COLLECTION}/documents/search?${params}`;
  const res = await fetch(url, { headers: { Accept: "application/json" } });
  if (!res.ok) throw new Error(`Typesense API error ${res.status}: ${await res.text()}`);
  return res.json();
}

/** Fetch ALL contacts via Typesense (fast bulk, ~20 requests for 4800+). */
export async function fetchAllContacts(): Promise<MMContact[]> {
  const contacts: MMContact[] = [];
  let page = 1;

  const first = await fetchTypesensePage(page);
  contacts.push(...first.hits.map((h) => h.document));
  const totalPages = Math.ceil(first.found / PER_PAGE);

  while (page < totalPages) {
    const batch: Promise<TypesenseSearchResponse>[] = [];
    for (let i = 0; i < 5 && page < totalPages; i++) {
      page++;
      batch.push(fetchTypesensePage(page));
    }
    const results = await Promise.all(batch);
    for (const r of results) {
      contacts.push(...r.hits.map((h) => h.document));
    }
  }

  return contacts;
}

/** Get facet counts for quick stats without fetching all docs. */
export async function fetchFacets(
  fields: string[]
): Promise<TypesenseSearchResponse["facet_counts"]> {
  const params = new URLSearchParams({
    q: "*",
    facet_by: fields.join(","),
    page: "1",
    per_page: "0",
    "x-typesense-api-key": getTypesenseKey(),
  });

  const url = `${TYPESENSE_HOST}/collections/${COLLECTION}/documents/search?${params}`;
  const res = await fetch(url, { headers: { Accept: "application/json" } });
  if (!res.ok) throw new Error(`Typesense API error ${res.status}: ${await res.text()}`);
  const data: TypesenseSearchResponse = await res.json();
  return data.facet_counts;
}

// ─── CRM API Client (conversations, rich detail) ──────────────────

const CRM_HOST = "https://crm.marketmuscles.com";
const LOCATION_ID = "loc_5e5y3urkri";

function getCRMToken(): string {
  const token = process.env.MM_CRM_TOKEN;
  if (!token) throw new Error("MM_CRM_TOKEN not set in environment");
  return token;
}

function crmApiBase(): string {
  return `${CRM_HOST}/api/${LOCATION_ID}`;
}

async function crmFetch(path: string): Promise<Response> {
  const url = `${crmApiBase()}${path}`;
  const res = await fetch(url, {
    headers: {
      Authorization: `Bearer ${getCRMToken()}`,
      Accept: "application/json",
    },
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`CRM API error ${res.status} on ${path}: ${text.slice(0, 200)}`);
  }
  return res;
}

/**
 * Fetch all conversation threads (paginated, 15/page).
 * Returns thread summaries with last message preview.
 */
export async function fetchAllConversations(): Promise<CRMConversationThread[]> {
  const threads: CRMConversationThread[] = [];
  let page = 1;
  let lastPage = 1;

  // First page
  const firstRes = await crmFetch(`/messages?page=${page}`);
  const first: CRMPaginatedResponse<CRMConversationThread> = await firstRes.json();
  threads.push(...first.data);
  lastPage = first.meta.last_page;

  // Remaining pages (3 at a time to be polite)
  while (page < lastPage) {
    const batch: Promise<Response>[] = [];
    for (let i = 0; i < 3 && page < lastPage; i++) {
      page++;
      batch.push(crmFetch(`/messages?page=${page}`));
    }
    const responses = await Promise.all(batch);
    for (const r of responses) {
      const data: CRMPaginatedResponse<CRMConversationThread> = await r.json();
      threads.push(...data.data);
    }
  }

  return threads;
}

/**
 * Fetch all messages in a specific conversation thread.
 * Thread messages are paginated (15/page within a thread).
 */
export async function fetchThreadMessages(threadId: string): Promise<CRMMessage[]> {
  const messages: CRMMessage[] = [];
  let page = 1;
  let lastPage = 1;

  const firstRes = await crmFetch(`/messages/${threadId}?page=${page}`);
  const first: CRMPaginatedResponse<CRMMessage> = await firstRes.json();
  messages.push(...first.data);
  lastPage = first.meta.last_page;

  // Fetch remaining pages
  while (page < lastPage) {
    const batch: Promise<Response>[] = [];
    for (let i = 0; i < 3 && page < lastPage; i++) {
      page++;
      batch.push(crmFetch(`/messages/${threadId}?page=${page}`));
    }
    const responses = await Promise.all(batch);
    for (const r of responses) {
      const data: CRMPaginatedResponse<CRMMessage> = await r.json();
      messages.push(...data.data);
    }
  }

  return messages;
}
