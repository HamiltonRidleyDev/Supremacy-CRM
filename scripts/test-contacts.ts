import Database from "better-sqlite3";
import { migrateContactSchema } from "../src/lib/contacts/schema";
import { populateContacts } from "../src/lib/contacts/populate";
import { batchComputeEngagement } from "../src/lib/contacts/engagement";

const db = new Database("./supremacy.db");
db.pragma("journal_mode = WAL");
db.pragma("foreign_keys = ON");

// Ensure base schema exists (students, leads, etc.)
const tables = db.prepare("SELECT name FROM sqlite_master WHERE type='table'").all().map((t: any) => t.name);
console.log("Existing tables:", tables.length);

if (!tables.includes("students")) {
  console.error("ERROR: students table not found. Run the app first to initialize the DB.");
  process.exit(1);
}

// Migrate contact schema
migrateContactSchema(db);
console.log("Contact schema migrated");

// Populate contacts
const popResult = populateContacts(db);
console.log("\n--- Population Result ---");
console.log(JSON.stringify(popResult, null, 2));

// Stats
const total = (db.prepare("SELECT COUNT(*) as c FROM contacts").get() as any).c;
const byType = db.prepare("SELECT contact_type, COUNT(*) as c FROM contacts GROUP BY contact_type ORDER BY c DESC").all();
const households = (db.prepare("SELECT COUNT(*) as c FROM household_links").get() as any).c;
const withStudent = (db.prepare("SELECT COUNT(*) as c FROM contacts WHERE student_id IS NOT NULL").get() as any).c;
const withLead = (db.prepare("SELECT COUNT(*) as c FROM contacts WHERE lead_id IS NOT NULL").get() as any).c;
const withMM = (db.prepare("SELECT COUNT(*) as c FROM contacts WHERE mm_id IS NOT NULL AND mm_id != ''").get() as any).c;
const withZivvy = (db.prepare("SELECT COUNT(*) as c FROM contacts WHERE zivvy_id IS NOT NULL AND zivvy_id != ''").get() as any).c;

console.log("\n--- Contact Stats ---");
console.log(`Total contacts: ${total}`);
console.log("By type:", JSON.stringify(byType));
console.log(`Households: ${households}`);
console.log(`With student: ${withStudent}`);
console.log(`With lead: ${withLead}`);
console.log(`With MM: ${withMM}`);
console.log(`With Zivvy: ${withZivvy}`);

// Run engagement scoring
console.log("\n--- Running Engagement Scoring ---");
const scoreResult = batchComputeEngagement(db);
console.log(JSON.stringify(scoreResult, null, 2));

// Sample some results
const sampleHealthy = db.prepare("SELECT first_name, last_name, engagement_score, risk_level FROM contacts WHERE risk_level = 'healthy' ORDER BY engagement_score DESC LIMIT 5").all();
const sampleAtRisk = db.prepare("SELECT first_name, last_name, engagement_score, risk_level, risk_factors FROM contacts WHERE risk_level IN ('at_risk', 'ghost') ORDER BY engagement_score ASC LIMIT 5").all();

console.log("\n--- Top 5 Healthy ---");
console.log(JSON.stringify(sampleHealthy, null, 2));

console.log("\n--- Top 5 At Risk / Ghost ---");
console.log(JSON.stringify(sampleAtRisk, null, 2));
