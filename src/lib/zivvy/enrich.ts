/**
 * Zivvy per-student enrichment: attendance history, rank promotions, and billing.
 *
 * Attendance + Ranks: HTML handlers on addmembers.com (parsed with cheerio)
 * Payments: JSON KendoGrid on coreapi.addmembers.com (clean API)
 */

import * as cheerio from "cheerio";
import { getCachedAuthCookie } from "./auth";

const SCHOOL_ID = process.env.ZIVVY_SCHOOL_ID || "3364";
const HANDLER_BASE = "https://addmembers.com/RainMaker";
const CORE_API = `https://coreapi.addmembers.com/${SCHOOL_ID}`;

// ---- Types ----

export interface AttendanceRecord {
  attendance_id: number;
  contact_id: number;
  display_date: string;       // "Saturday, March 07, 2026"
  entry_timestamp: string;    // "03/04/2026 03:42:06 PM"
  entry_method: string;       // "Kiosk", "KIOSK_MOBILE", "Manually", "unknown"
  roster_name: string | null;
  style: string | null;
  parsed_date: string;        // ISO "2026-03-07"
}

export interface RankRecord {
  promotion_id: number;
  contact_id: number;
  promotion_date: string;     // ISO "2025-05-25"
  rank: string;               // "Purple/2 stripe", "White Belt"
  belt_color: string;         // "purple", "white"
  stripes: number;            // 0, 1, 2, 3, 4
  style: string;              // "Brazilian Jiu Jitsu"
  size: string | null;
}

export interface PaymentRecord {
  id: number;
  contact_id: number;
  date_processed: string;
  payment_status: string;     // "Approved", "Declined", "Error"
  amount: number;
  description: string;
  payment_type: string;
  method: string;
  first_name: string;
  last_name: string;
}

export interface EnrichmentResult {
  attendance: AttendanceRecord[];
  total_classes: number;
  last_attendance: string | null; // ISO date
}

export interface BulkPaymentResult {
  payments: PaymentRecord[];
  // Map of contactId -> computed monthly rate (most recent payment)
  monthly_rates: Map<number, number>;
  // Map of contactId -> sum of all approved payments (actual LTV)
  total_collected: Map<number, number>;
}

// ---- HTML Handler Fetchers ----

async function fetchHandler(
  authCookie: string,
  handler: string,
  contactId: number,
  months: string = "All"
): Promise<string> {
  const url = `${HANDLER_BASE}/${handler}`;
  const res = await fetch(url, {
    method: "POST",
    headers: {
      Cookie: authCookie,
      "Content-Type": "application/x-www-form-urlencoded; charset=UTF-8",
      Origin: "https://app.addmembers.com",
      Referer: "https://app.addmembers.com/",
    },
    body: `contactId=${contactId}&months=${months}`,
  });

  if (!res.ok) {
    throw new Error(`Handler ${handler} failed: ${res.status} ${res.statusText}`);
  }
  return res.text();
}

// ---- Attendance Parser ----

function parseDisplayDate(text: string): string {
  // "Saturday, March 07, 2026" -> "2026-03-07"
  const cleaned = text.replace(/^\w+,\s*/, "").trim(); // remove day name
  const d = new Date(cleaned);
  if (isNaN(d.getTime())) return "";
  return d.toISOString().split("T")[0];
}

export function parseAttendanceHtml(html: string, contactId: number): AttendanceRecord[] {
  const $ = cheerio.load(html);
  const records: AttendanceRecord[] = [];

  const rows = $("table tr").toArray();
  for (const row of rows) {
    const cells = $(row).find("td");
    if (cells.length < 2) continue;

    // First cell: span with date + title containing timestamp + entry method
    const span = $(cells[0]).find("span");
    if (!span.length) continue;

    const displayDate = span.text().replace(/\s+/g, " ").trim();
    if (!displayDate || displayDate.includes("Class")) continue; // skip header

    const titleAttr = span.attr("title") || "";
    // Parse title: "03/04/2026 03:42:06 PM\nentered via: Kiosk"
    const titleParts = titleAttr.split(/[\r\n]+/).map((s) => s.trim());
    const entryTimestamp = titleParts[0] || "";
    const entryMethod = (titleParts.find((p) => p.startsWith("entered via:")) || "")
      .replace("entered via:", "")
      .trim() || "unknown";

    // Delete link has attendance ID
    const deleteLink = $(cells[cells.length - 1]).find("a").attr("href") || "";
    const idMatch = deleteLink.match(/ID=(\d+)/);
    const attendanceId = idMatch ? parseInt(idMatch[1]) : 0;

    // Roster name (2nd cell)
    const rosterName = $(cells[1]).text().trim() || null;

    // Style (4th cell if exists)
    const style = cells.length >= 4 ? $(cells[3]).text().trim() || null : null;

    const parsedDate = parseDisplayDate(displayDate);

    if (parsedDate) {
      records.push({
        attendance_id: attendanceId,
        contact_id: contactId,
        display_date: displayDate,
        entry_timestamp: entryTimestamp,
        entry_method: entryMethod,
        roster_name: rosterName,
        style: style,
        parsed_date: parsedDate,
      });
    }
  }

  return records;
}

// ---- Rank Parser ----

function parseRankString(rank: string): { belt_color: string; stripes: number } {
  // "Purple/2 stripe" -> { belt_color: "purple", stripes: 2 }
  // "White Belt" -> { belt_color: "white", stripes: 0 }
  // "Blue/4 stripe" -> { belt_color: "blue", stripes: 4 }
  const cleaned = rank.replace(/&nbsp;/g, "").trim();
  const slashMatch = cleaned.match(/^(\w+)\/(\d+)\s*stripe/i);
  if (slashMatch) {
    return { belt_color: slashMatch[1].toLowerCase(), stripes: parseInt(slashMatch[2]) };
  }
  const beltMatch = cleaned.match(/^(\w+)\s*Belt/i);
  if (beltMatch) {
    return { belt_color: beltMatch[1].toLowerCase(), stripes: 0 };
  }
  return { belt_color: cleaned.toLowerCase(), stripes: 0 };
}

export function parseRanksHtml(html: string, contactId: number): RankRecord[] {
  const $ = cheerio.load(html);
  const records: RankRecord[] = [];

  const rows = $("table tr").toArray();
  for (const row of rows) {
    const cells = $(row).find("td");
    if (cells.length < 4) continue;

    const dateText = $(cells[0]).text().replace(/&nbsp;/g, "").trim();
    const rankText = $(cells[1]).text().replace(/&nbsp;/g, "").trim();
    const styleText = $(cells[2]).text().replace(/&nbsp;/g, "").trim();
    const sizeText = $(cells[3]).text().replace(/&nbsp;/g, "").trim();

    // Skip header row
    if (dateText === "Promotion Date" || !dateText) continue;

    // Parse promotion date
    const parsedDate = parseDisplayDate(dateText);
    if (!parsedDate) continue;

    // Parse rank
    const { belt_color, stripes } = parseRankString(rankText);

    // Get promotion ID from delete link
    const deleteLink = $(cells[cells.length - 1]).find("a").attr("href") || "";
    const idMatch = deleteLink.match(/ID=(\d+)/);
    const promotionId = idMatch ? parseInt(idMatch[1]) : 0;

    records.push({
      promotion_id: promotionId,
      contact_id: contactId,
      promotion_date: parsedDate,
      rank: rankText,
      belt_color,
      stripes,
      style: styleText || "Brazilian Jiu Jitsu",
      size: sizeText || null,
    });
  }

  return records;
}

// ---- Payment Fetcher (JSON KendoGrid) ----

interface PaymentGridResponse {
  data: Array<{
    id: number;
    contactId: number;
    dateProcessed: string;
    paymentStatus: string;
    amount: number;
    description: string;
    paymentType: string;
    method: string;
    firstName: string;
    lastName: string;
    responseReason: string;
    contactType: string;
  }>;
  total: number;
}

async function fetchPaymentPage(
  authCookie: string,
  page: number,
  pageSize: number,
  filter: string
): Promise<PaymentGridResponse> {
  const params = new URLSearchParams({
    page: page.toString(),
    pageSize: pageSize.toString(),
    filter,
    sort: "timeStamp-desc",
  });

  const res = await fetch(`${CORE_API}/Payments/v1/KendoGrid?${params}`, {
    headers: {
      Cookie: authCookie,
      Accept: "application/json",
    },
  });

  if (!res.ok) {
    throw new Error(`Payment API error: ${res.status}`);
  }
  return res.json();
}

// ---- Public Enrichment Functions ----

/**
 * Fetch attendance history for a single student.
 */
export async function fetchAttendance(contactId: number): Promise<EnrichmentResult> {
  const authCookie = await getCachedAuthCookie();
  const html = await fetchHandler(authCookie, "ContactAttendanceHandler.ashx", contactId, "All");
  const records = parseAttendanceHtml(html, contactId);

  // Sort by date descending
  records.sort((a, b) => b.parsed_date.localeCompare(a.parsed_date));

  return {
    attendance: records,
    total_classes: records.length,
    last_attendance: records.length > 0 ? records[0].parsed_date : null,
  };
}

/**
 * Fetch rank/promotion history for a single student.
 */
export async function fetchRanks(contactId: number): Promise<RankRecord[]> {
  const authCookie = await getCachedAuthCookie();
  const html = await fetchHandler(authCookie, "ContactRanksHandler.ashx", contactId, "All");
  const records = parseRanksHtml(html, contactId);

  // Sort by date descending (most recent first)
  records.sort((a, b) => b.promotion_date.localeCompare(a.promotion_date));
  return records;
}

/**
 * Fetch all approved autoCollect payments in bulk (not per-student).
 * Returns monthly rates computed from most recent payment per contact.
 */
export async function fetchAllPayments(
  monthsBack: number = 3,
  onProgress?: (fetched: number, total: number) => void
): Promise<BulkPaymentResult> {
  const authCookie = await getCachedAuthCookie();

  const since = new Date();
  since.setMonth(since.getMonth() - monthsBack);
  const sinceStr = since.toISOString().split("T")[0] + "T00-00-00";

  const filter = [
    `paymentStatus~eq~'approved'`,
    `description~contains~'autoCollect'`,
    `timeStamp~gte~datetime'${sinceStr}'`,
  ].join("~and~");

  // Fetch first page to get total
  const PAGE_SIZE = 200;
  const first = await fetchPaymentPage(authCookie, 1, PAGE_SIZE, filter);
  const allPayments: PaymentRecord[] = first.data.map(mapPayment);
  onProgress?.(allPayments.length, first.total);

  // Fetch remaining pages
  const totalPages = Math.ceil(first.total / PAGE_SIZE);
  for (let p = 2; p <= totalPages; p++) {
    const page = await fetchPaymentPage(authCookie, p, PAGE_SIZE, filter);
    allPayments.push(...page.data.map(mapPayment));
    onProgress?.(allPayments.length, first.total);
  }

  // Compute monthly rate per contact from most recent payment
  const monthlyRates = new Map<number, number>();
  // Group by contactId, take the most recent amount
  const byContact = new Map<number, PaymentRecord[]>();
  for (const p of allPayments) {
    if (!byContact.has(p.contact_id)) byContact.set(p.contact_id, []);
    byContact.get(p.contact_id)!.push(p);
  }

  const totalCollected = new Map<number, number>();
  for (const [contactId, payments] of byContact) {
    // Sort by date desc, take most recent
    payments.sort((a, b) => b.date_processed.localeCompare(a.date_processed));
    monthlyRates.set(contactId, payments[0].amount);
    // Sum all approved payments for actual LTV
    const sum = payments.reduce((s, p) => s + p.amount, 0);
    totalCollected.set(contactId, Math.round(sum * 100) / 100);
  }

  return { payments: allPayments, monthly_rates: monthlyRates, total_collected: totalCollected };
}

function mapPayment(raw: PaymentGridResponse["data"][0]): PaymentRecord {
  return {
    id: raw.id,
    contact_id: raw.contactId,
    date_processed: raw.dateProcessed,
    payment_status: raw.paymentStatus,
    amount: raw.amount,
    description: raw.description,
    payment_type: raw.paymentType || "",
    method: raw.method || "",
    first_name: raw.firstName,
    last_name: raw.lastName,
  };
}

/**
 * Fetch attendance for a batch of students.
 * Concurrency defaults to 3 to be gentle on Zivvy's server.
 */
export async function enrichAttendanceBatch(
  contactIds: number[],
  concurrency: number = 3,
  onProgress?: (completed: number, total: number) => void
): Promise<Map<number, EnrichmentResult>> {
  const results = new Map<number, EnrichmentResult>();
  let completed = 0;

  for (let i = 0; i < contactIds.length; i += concurrency) {
    const chunk = contactIds.slice(i, i + concurrency);
    const promises = chunk.map(async (cid) => {
      try {
        const attendance = await fetchAttendance(cid);
        results.set(cid, attendance);
      } catch (err) {
        console.warn(`Attendance fetch failed for contact ${cid}:`, err);
      }
      completed++;
      onProgress?.(completed, contactIds.length);
    });
    await Promise.all(promises);
  }

  return results;
}

/**
 * Fetch ranks for a batch of students (one-time backfill or on-demand).
 * Separate from attendance sync since ranks change rarely.
 */
export async function enrichRanksBatch(
  contactIds: number[],
  concurrency: number = 3,
  onProgress?: (completed: number, total: number) => void
): Promise<Map<number, RankRecord[]>> {
  const results = new Map<number, RankRecord[]>();
  let completed = 0;

  for (let i = 0; i < contactIds.length; i += concurrency) {
    const chunk = contactIds.slice(i, i + concurrency);
    const promises = chunk.map(async (cid) => {
      try {
        const ranks = await fetchRanks(cid);
        results.set(cid, ranks);
      } catch (err) {
        console.warn(`Ranks fetch failed for contact ${cid}:`, err);
      }
      completed++;
      onProgress?.(completed, contactIds.length);
    });
    await Promise.all(promises);
  }

  return results;
}
