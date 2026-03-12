import type { MMContact } from "./types";

/**
 * Map MM tags to a primary interest for the leads table.
 * Tags like "interested-in-bjj", "interested-in-kids-ma" etc.
 */
export function tagsToInterest(tags: string[]): string {
  if (!tags || tags.length === 0) return "adult_gi";

  // Check for specific interest tags (order matters — first match wins)
  for (const tag of tags) {
    if (tag.includes("kids-ma") || tag.includes("little-ninja") || tag.includes("tiny-ninja"))
      return "kids";
    if (tag.includes("muay-thai")) return "muay_thai";
    if (tag.includes("boxing")) return "boxing";
    if (tag.includes("bjj")) return "adult_gi";
  }

  // Motivation tags (not program-specific) — default to adult
  return "adult_gi";
}

/**
 * Map MM tags to a motivation/benefit string for enrichment.
 * Strips "interested-in-*" tags and returns the rest as motivations.
 */
export function tagsToMotivations(tags: string[]): string[] {
  if (!tags) return [];
  return tags
    .filter((t) => !t.startsWith("interested-in-"))
    .map((t) => t.replace(/-/g, " "));
}

/**
 * Map MM referrer to a source string compatible with our leads table.
 */
export function mapSource(contact: MMContact): string {
  const ref = contact.referrer;
  if (!ref) return "website";

  const medium = (ref.medium || "").toLowerCase();
  const source = (ref.source || "").toLowerCase();

  if (medium === "paid" || source.includes("google") && medium !== "organic")
    return "google_ads";
  if (source.includes("facebook") || source.includes("fb"))
    return "social_media";
  if (source.includes("yelp")) return "yelp";
  if (source.includes("supremacy")) return "website";

  return "website";
}

/**
 * Normalize phone for matching (strip non-digits, drop leading 1 for US).
 */
export function normalizePhone(phone: string | null): string | null {
  if (!phone) return null;
  const digits = phone.replace(/\D/g, "");
  // US numbers: drop leading 1 if 11 digits
  if (digits.length === 11 && digits.startsWith("1")) return digits.slice(1);
  return digits || null;
}

/**
 * Normalize email for matching (lowercase, trim).
 */
export function normalizeEmail(email: string | null): string | null {
  if (!email) return null;
  return email.toLowerCase().trim() || null;
}

/**
 * Map an MM contact to a lead record for upsert.
 */
export function mapToLead(contact: MMContact) {
  return {
    mm_id: contact.id,
    first_name: contact.first_name || "Unknown",
    last_name: contact.last_name || "",
    email: contact.email_address || null,
    phone: contact.phone_number || null,
    source: mapSource(contact),
    interest: tagsToInterest(contact.tags),
    status: "new" as const,
    notes: contact.tags?.length
      ? `MM tags: ${contact.tags.join(", ")}`
      : null,
  };
}
