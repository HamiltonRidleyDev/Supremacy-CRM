import { getCachedAuthCookie, clearAuthCache } from "./auth";
import type { ZivvyContact, ZivvyGridResponse } from "./types";

const SCHOOL_ID = process.env.ZIVVY_SCHOOL_ID || "3364";
const BASE_URL = `https://coreapi.addmembers.com/${SCHOOL_ID}`;
const KENDO_ENDPOINT = `${BASE_URL}/Contacts/v1/KendoGrid`;
const PAGE_SIZE = 200;

/**
 * Fetch a single page from the KendoGrid endpoint.
 */
async function fetchPage(
  authCookie: string,
  page: number,
  filter?: string,
  sort?: string
): Promise<ZivvyGridResponse> {
  const params = new URLSearchParams({
    page: page.toString(),
    pageSize: PAGE_SIZE.toString(),
  });

  if (filter) params.set("filter", filter);
  if (sort) params.set("sort", sort);

  const url = `${KENDO_ENDPOINT}?${params.toString()}`;

  const res = await fetch(url, {
    headers: {
      Cookie: authCookie,
      Accept: "application/json",
    },
  });

  if (res.status === 401 || res.status === 403) {
    clearAuthCache();
    throw new Error(`Zivvy API auth failed (${res.status}). Cookie may have expired.`);
  }

  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(`Zivvy API error: ${res.status} ${res.statusText} — ${body.slice(0, 200)}`);
  }

  return res.json();
}

/**
 * Fetch ALL contacts of a given type, handling pagination automatically.
 * @param contactType - 'S' (students), 'P' (prospects), 'F' (former), 'C' (staff)
 */
export async function fetchAllContacts(
  contactType: string,
  onProgress?: (fetched: number, total: number) => void
): Promise<ZivvyContact[]> {
  const authCookie = await getCachedAuthCookie();
  const filter = `contactType~eq~'${contactType}'`;
  const sort = "lastName-asc";

  // First page to get total count
  const firstPage = await fetchPage(authCookie, 1, filter, sort);
  const total = firstPage.total;
  const allContacts: ZivvyContact[] = [...firstPage.data];

  onProgress?.(allContacts.length, total);

  // Fetch remaining pages
  const totalPages = Math.ceil(total / PAGE_SIZE);
  for (let p = 2; p <= totalPages; p++) {
    const page = await fetchPage(authCookie, p, filter, sort);
    allContacts.push(...page.data);
    onProgress?.(allContacts.length, total);
  }

  return allContacts;
}

/**
 * Fetch all contact types needed for sync.
 * Returns { students, prospects, former }.
 */
export async function fetchAllSyncData(
  onProgress?: (label: string, fetched: number, total: number) => void
): Promise<{
  students: ZivvyContact[];
  prospects: ZivvyContact[];
  former: ZivvyContact[];
}> {
  const students = await fetchAllContacts("S", (f, t) =>
    onProgress?.("students", f, t)
  );
  const prospects = await fetchAllContacts("P", (f, t) =>
    onProgress?.("prospects", f, t)
  );
  const former = await fetchAllContacts("F", (f, t) =>
    onProgress?.("former", f, t)
  );

  return { students, prospects, former };
}
