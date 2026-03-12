import Database from "better-sqlite3";
import { batchComputeEngagement } from "../src/lib/contacts/engagement";

const db = new Database("./supremacy.db");
db.pragma("journal_mode = WAL");
db.pragma("foreign_keys = ON");

console.log("Running engagement scoring...");
const result = batchComputeEngagement(db);
console.log(JSON.stringify(result, null, 2));

console.log("\nHealthy:");
const healthy = db.prepare("SELECT first_name, last_name, engagement_score, score_attendance, score_communication, monthly_revenue FROM contacts WHERE risk_level = 'healthy' ORDER BY engagement_score DESC LIMIT 5").all();
console.log(JSON.stringify(healthy, null, 2));

console.log("\nCooling:");
const cooling = db.prepare("SELECT first_name, last_name, engagement_score, score_attendance, score_communication, monthly_revenue FROM contacts WHERE risk_level = 'cooling' ORDER BY engagement_score DESC LIMIT 5").all();
console.log(JSON.stringify(cooling, null, 2));

console.log("\nAt-risk:");
const atRisk = db.prepare("SELECT first_name, last_name, engagement_score, risk_factors, monthly_revenue FROM contacts WHERE risk_level = 'at_risk' ORDER BY monthly_revenue DESC NULLS LAST LIMIT 5").all();
console.log(JSON.stringify(atRisk, null, 2));

console.log("\nGhost:");
const ghost = db.prepare("SELECT first_name, last_name, engagement_score, risk_factors, monthly_revenue FROM contacts WHERE risk_level = 'ghost' ORDER BY monthly_revenue DESC NULLS LAST LIMIT 5").all();
console.log(JSON.stringify(ghost, null, 2));

console.log("\nActive members breakdown:");
const breakdown = db.prepare("SELECT risk_level, COUNT(*) as count, ROUND(AVG(engagement_score),1) as avg_score, ROUND(SUM(monthly_revenue),0) as revenue FROM contacts WHERE contact_type = 'active_member' GROUP BY risk_level ORDER BY count DESC").all();
console.log(JSON.stringify(breakdown, null, 2));
