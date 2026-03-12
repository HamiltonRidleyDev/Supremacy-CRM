import Database from "better-sqlite3";
const db = new Database("./supremacy.db");

const withLastAttend = db.prepare("SELECT COUNT(*) as c FROM students WHERE last_attendance IS NOT NULL AND last_attendance != ''").get();
console.log("Students with last_attendance:", withLastAttend);

const totalActive = db.prepare("SELECT COUNT(*) as c FROM students WHERE membership_status = 'active'").get();
console.log("Active students:", totalActive);

const sample = db.prepare("SELECT first_name, last_name, last_attendance, total_classes, start_date, membership_status, monthly_rate FROM students WHERE membership_status = 'active' LIMIT 5").all();
console.log("Active sample:", JSON.stringify(sample, null, 2));

const zivvySample = db.prepare("SELECT first_name, last_name, last_attend, contact_type FROM zivvy_contacts WHERE contact_type = 'S' LIMIT 5").all();
console.log("Zivvy sample:", JSON.stringify(zivvySample, null, 2));

// Check columns
const cols = db.prepare("PRAGMA table_info(students)").all().map((c: any) => c.name);
console.log("Students columns:", cols.filter(c => c.includes("attend") || c.includes("class") || c.includes("total")));

const zCols = db.prepare("PRAGMA table_info(zivvy_contacts)").all().map((c: any) => c.name);
console.log("Zivvy columns:", zCols.filter(c => c.includes("attend") || c.includes("class") || c.includes("total") || c.includes("last")));
