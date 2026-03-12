import Database from "better-sqlite3";
const db = new Database("./supremacy.db");

const sample = db.prepare("SELECT raw_json FROM zivvy_contacts WHERE contact_type = 'S' LIMIT 1").get() as any;
if (!sample?.raw_json) {
  console.log("No raw_json found");
  process.exit(1);
}

const parsed = JSON.parse(sample.raw_json);
const keys = Object.keys(parsed);
console.log("Total fields in raw Zivvy JSON:", keys.length);

const categories: Record<string, string[]> = {
  "Attendance/Classes": keys.filter(k => /attend|class|checkin|check_in|visit/i.test(k)),
  "Billing/Financial": keys.filter(k => /bill|rate|price|payment|amount|tuition|fee|collect|charge|invoice|balance|due/i.test(k)),
  "Rank/Belt": keys.filter(k => /rank|belt|stripe|promotion|grade|level/i.test(k)),
  "Membership/Program": keys.filter(k => /member|program|contract|plan|subscription|enroll/i.test(k)),
  "Last/Date fields": keys.filter(k => /^last|date/i.test(k)),
};

for (const [category, matchedKeys] of Object.entries(categories)) {
  console.log(`\n=== ${category} (${matchedKeys.length} fields) ===`);
  for (const k of matchedKeys) {
    console.log(`  ${k}: ${JSON.stringify(parsed[k])}`);
  }
}

// Also print ALL keys so we can see what we're working with
console.log("\n=== ALL FIELD NAMES ===");
console.log(keys.join(", "));
