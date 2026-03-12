import { initDb } from "./db";
import bcrypt from "bcryptjs";

export function seed() {
  const db = initDb();

  // Seed class types if empty
  const classTypeCount = db.prepare("SELECT COUNT(*) as c FROM class_types").get() as { c: number };
  if (classTypeCount.c === 0) {
    const insertClassType = db.prepare(
      "INSERT INTO class_types (name, description, min_belt, is_gi) VALUES (?, ?, ?, ?)"
    );
    const classTypes = [
      ["Adult Gi", "All levels gi class", "white", 1],
      ["Adult No-Gi", "All levels no-gi class", "white", 0],
      ["Advanced Gi", "Blue belt and above", "blue", 1],
      ["Advanced No-Gi", "Blue belt and above no-gi", "blue", 0],
      ["Kids (6-12)", "Children's class", "white", 1],
      ["Teens (13-17)", "Teenagers class", "white", 1],
      ["Open Mat", "Free training", "white", 1],
      ["Competition Team", "Competition prep", "blue", 0],
    ] as const;
    for (const ct of classTypes) {
      insertClassType.run(...ct);
    }
  }

  // Seed schedule if empty
  const scheduleCount = db.prepare("SELECT COUNT(*) as c FROM schedule").get() as { c: number };
  if (scheduleCount.c === 0) {
    const insertSchedule = db.prepare(
      "INSERT INTO schedule (class_type_id, day_of_week, start_time, end_time, instructor) VALUES (?, ?, ?, ?, ?)"
    );
    const scheduleData = [
      [1, 1, "12:00", "13:00", "Rodrigo"], // Mon noon Gi
      [2, 1, "18:00", "19:00", "Rodrigo"], // Mon eve No-Gi
      [5, 1, "16:30", "17:15", "Kyle"],     // Mon kids
      [1, 2, "12:00", "13:00", "Rodrigo"], // Tue noon Gi
      [3, 2, "18:00", "19:00", "Rodrigo"], // Tue eve Advanced Gi
      [6, 2, "16:30", "17:15", "Kyle"],     // Tue teens
      [1, 3, "12:00", "13:00", "Rodrigo"], // Wed noon Gi
      [2, 3, "18:00", "19:00", "Rodrigo"], // Wed eve No-Gi
      [5, 3, "16:30", "17:15", "Kyle"],     // Wed kids
      [1, 4, "12:00", "13:00", "Rodrigo"], // Thu noon Gi
      [3, 4, "18:00", "19:00", "Rodrigo"], // Thu eve Advanced Gi
      [6, 4, "16:30", "17:15", "Kyle"],     // Thu teens
      [1, 5, "12:00", "13:00", "Rodrigo"], // Fri noon Gi
      [4, 5, "18:00", "19:00", "Rodrigo"], // Fri eve Advanced No-Gi
      [7, 6, "10:00", "12:00", "Rodrigo"], // Sat Open Mat
      [8, 6, "08:00", "09:30", "Rodrigo"], // Sat Comp Team
    ];
    for (const s of scheduleData) {
      insertSchedule.run(...s);
    }
  }

  // Seed techniques / curriculum if empty
  const techCount = db.prepare("SELECT COUNT(*) as c FROM techniques").get() as { c: number };
  if (techCount.c === 0) {
    const insertTechnique = db.prepare(
      "INSERT INTO techniques (name, category, subcategory, belt_level, is_gi, description) VALUES (?, ?, ?, ?, ?, ?)"
    );
    const techniques = [
      // Guard
      ["Closed Guard Basics", "guard", "closed_guard", "white", 1, "Posture control, hip movement, basic attacks from closed guard"],
      ["Scissor Sweep", "sweeps", "closed_guard", "white", 1, "Classic sweep from closed guard"],
      ["Hip Bump Sweep", "sweeps", "closed_guard", "white", 1, "Explosive sweep from closed guard"],
      ["Triangle Choke", "submissions", "closed_guard", "white", 1, "Fundamental submission from guard"],
      ["Armbar from Guard", "submissions", "closed_guard", "white", 1, "High percentage attack from closed guard"],
      ["Open Guard Retention", "guard", "open_guard", "white", 1, "Frames, grips, and hip movement to maintain open guard"],
      ["De La Riva Guard", "guard", "open_guard", "blue", 1, "DLR hook, grips, and basic sweeps"],
      ["Spider Guard", "guard", "open_guard", "blue", 1, "Sleeve and foot-on-bicep control"],
      ["Half Guard Underhook", "guard", "half_guard", "white", 1, "Getting the underhook and coming to dog fight"],
      ["Butterfly Guard Basics", "guard", "butterfly", "white", 0, "Hooks, overhook/underhook, basic elevations"],
      // Passing
      ["Toreando Pass", "passing", "standing", "white", 1, "Bullfighter pass - grip pants, push/pull to pass"],
      ["Knee Slice Pass", "passing", "half_guard", "white", 1, "Slide knee through to pass half guard"],
      ["Over-Under Pass", "passing", "pressure", "blue", 1, "Pressure pass controlling one leg over, one under"],
      ["Leg Drag Pass", "passing", "standing", "blue", 0, "Control the leg across to pass"],
      ["Stack Pass", "passing", "pressure", "white", 1, "Stack opponent and walk around to pass"],
      // Takedowns
      ["Double Leg Takedown", "takedowns", "wrestling", "white", 0, "Level change, penetration step, drive through"],
      ["Single Leg Takedown", "takedowns", "wrestling", "white", 0, "Capture one leg, finish with trip or lift"],
      ["Osoto Gari", "takedowns", "judo", "white", 1, "Major outer reap - classic judo throw"],
      ["Collar Drag", "takedowns", "wrestling", "white", 1, "Use collar grip to snap down and take back or get to top"],
      ["Arm Drag to Back", "takedowns", "wrestling", "white", 0, "2-on-1 arm drag to back take"],
      // Submissions
      ["Rear Naked Choke", "submissions", "back", "white", 0, "Fundamental choke from back control"],
      ["Cross Collar Choke", "submissions", "mount", "white", 1, "Gi choke from mount position"],
      ["Kimura", "submissions", "top_control", "white", 1, "Double wristlock from various positions"],
      ["Americana", "submissions", "top_control", "white", 1, "Keylock from mount or side control"],
      ["Guillotine Choke", "submissions", "front_headlock", "white", 0, "Front headlock choke, standing or guard"],
      ["D'Arce Choke", "submissions", "front_headlock", "blue", 0, "Arm-in choke from front headlock"],
      ["Ezekiel Choke", "submissions", "mount", "blue", 1, "Sleeve choke from mount"],
      // Escapes
      ["Mount Escape - Upa", "escapes", "mount", "white", 1, "Bridge and roll escape from mount"],
      ["Mount Escape - Elbow Knee", "escapes", "mount", "white", 1, "Shrimp to half guard from mount"],
      ["Side Control Escape", "escapes", "side_control", "white", 1, "Frame, shrimp, recover guard"],
      ["Back Escape", "escapes", "back", "white", 1, "Fight hands, get shoulders to mat, escape"],
      // Back attacks
      ["Back Take from Turtle", "back", "turtle", "white", 1, "Seatbelt, hook insertion from turtle"],
      ["Back Control & Maintenance", "back", "back_control", "white", 0, "Body triangle/hooks, seatbelt grip, staying attached"],
      ["Bow and Arrow Choke", "submissions", "back", "blue", 1, "Collar and pants grip choke from back"],
      // Top control
      ["Mount Maintenance", "top_control", "mount", "white", 1, "Staying in mount, dealing with escapes"],
      ["Side Control - Crossface & Underhook", "top_control", "side_control", "white", 1, "Fundamentals of holding side control"],
      ["Knee on Belly", "top_control", "knee_on_belly", "blue", 1, "Pressure position, transitions, attacks"],
      ["North-South Control", "top_control", "north_south", "blue", 1, "Controlling from north-south, kimura attacks"],
      // Turtle
      ["Turtle Defense", "escapes", "turtle", "white", 1, "Protecting neck, recovering guard from turtle"],
      ["Turtle to Single Leg", "takedowns", "turtle", "white", 0, "Offensive turtle - come up on a single leg"],
    ];
    for (const t of techniques) {
      insertTechnique.run(...t);
    }
  }

  // Seed users if empty
  const userCount = db.prepare("SELECT COUNT(*) as c FROM users").get() as { c: number };
  if (userCount.c === 0) {
    const insertUser = db.prepare(
      `INSERT INTO users (email, phone, role, password_hash, student_id, display_name, is_active, last_login)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
    );
    const initialPassword = process.env.INITIAL_ADMIN_PASSWORD || "supremacy2026";
    const hash = bcrypt.hashSync(initialPassword, 10);
    insertUser.run("rodrigo@supremacyjj.com", "727-555-0001", "admin", hash, null, "Rodrigo", 1, null);
    insertUser.run("dan@supremacyjj.com", null, "admin", hash, null, "Dan", 1, null);
    insertUser.run("kyle@supremacyjj.com", "727-555-0002", "manager", null, null, "Kyle", 1, null);
  }

  // Seed community channels if empty
  const channelCount = db.prepare("SELECT COUNT(*) as c FROM channels").get() as { c: number };
  if (channelCount.c === 0) {
    const insertChannel = db.prepare(
      "INSERT INTO channels (name, description, type, auto_join_filter, created_by) VALUES (?, ?, ?, ?, ?)"
    );
    const channelsData = [
      ["General", "Main gym chat — everyone welcome", "public", null, "Rodrigo"],
      ["Announcements", "Schedule changes, events, and gym news", "announcement", null, "Rodrigo"],
      ["Competition Team", "Comp prep discussion, tournament info, training partners", "public", '{"min_belt":"blue"}', "Rodrigo"],
      ["Beginners Lounge", "New to BJJ? Ask questions here, no judgment", "public", null, "Rodrigo"],
      ["No-Gi Crew", "No-gi training, techniques, and session planning", "public", null, "Rodrigo"],
      ["Parents Corner", "For parents of kids/teens students", "public", null, "Kyle"],
    ];
    for (const ch of channelsData) {
      insertChannel.run(...ch);
    }
  }

  // Seed survey templates if empty
  const templateCount = db.prepare("SELECT COUNT(*) as c FROM survey_templates").get() as { c: number };
  if (templateCount.c === 0) {
    const insertTemplate = db.prepare(
      "INSERT INTO survey_templates (name, slug, description, target_type, questions, created_by) VALUES (?, ?, ?, ?, ?, ?)"
    );

    insertTemplate.run(
      "New Member Welcome",
      "new-member",
      "Quick survey for new students to help us personalize your experience",
      "student",
      JSON.stringify([
        { key: "preferred_contact", label: "How do you prefer we reach you?", type: "select", options: ["Text", "Email", "Phone Call", "Instagram DM"], required: true, profile_field: "preferred_contact" },
        { key: "best_time", label: "Best time to reach you?", type: "select", options: ["Morning (8-12)", "Afternoon (12-5)", "Evening (5-9)"], required: false, profile_field: "best_time_to_reach" },
        { key: "instagram_handle", label: "Instagram handle (so we can tag you in posts!)", type: "text", placeholder: "@yourusername", required: false, profile_field: "instagram_handle" },
        { key: "motivation", label: "What's your main reason for training?", type: "select", options: ["Fitness / Weight Loss", "Self Defense", "Competition", "Fun / Hobby", "Stress Relief", "Social / Community"], required: true, profile_field: "motivation" },
        { key: "prior_training", label: "Have you trained martial arts before?", type: "select", options: ["No, brand new", "Less than 1 year", "1-3 years", "3+ years"], required: true, profile_field: "prior_training" },
        { key: "prior_gym", label: "If yes, what gym did you train at?", type: "text", placeholder: "Gym name (optional)", required: false, profile_field: "prior_gym" },
        { key: "goals", label: "What are your training goals? (e.g., earn blue belt, compete, lose 20lbs)", type: "textarea", required: false, profile_field: "goals" },
        { key: "how_heard", label: "How did you hear about Supremacy?", type: "select", options: ["Google Search", "Instagram/Facebook", "Friend/Referral", "Drove By", "Yelp/Google Reviews", "Other"], required: true, profile_field: "how_heard" },
        { key: "referral_name", label: "If referred, who sent you?", type: "text", placeholder: "Their name", required: false, profile_field: "referral_name" },
        { key: "schedule_preference", label: "When do you plan to train most?", type: "select", options: ["Mornings (Noon classes)", "Evenings", "Weekends", "Flexible / Mix"], required: true, profile_field: "schedule_preference" },
        { key: "frequency_target", label: "How many times per week are you aiming to train?", type: "select", options: ["1x/week", "2x/week", "3x/week", "4-5x/week", "Not sure yet"], required: false, profile_field: "training_frequency_target" },
        { key: "gi_or_nogi", label: "Gi, No-Gi, or both?", type: "select", options: ["Gi", "No-Gi", "Both", "Not sure yet"], required: false, profile_field: "gi_or_nogi" },
        { key: "injuries", label: "Any injuries or physical limitations we should know about?", type: "textarea", placeholder: "e.g., bad knee, shoulder surgery", required: false, profile_field: "injuries_concerns" },
        { key: "opt_in", label: "Can we send you occasional updates about events and promotions?", type: "select", options: ["Yes", "No"], required: true, profile_field: "opt_in_marketing" },
      ]),
      "Rodrigo"
    );

    insertTemplate.run(
      "Member Profile Update",
      "member-update",
      "Help us keep your info up to date and serve you better",
      "student",
      JSON.stringify([
        { key: "preferred_contact", label: "Preferred way to reach you?", type: "select", options: ["Text", "Email", "Phone Call", "Instagram DM"], required: true, profile_field: "preferred_contact" },
        { key: "instagram_handle", label: "Instagram handle", type: "text", placeholder: "@yourusername", required: false, profile_field: "instagram_handle" },
        { key: "goals", label: "What are you working toward right now?", type: "textarea", placeholder: "e.g., compete in April, hit 3x/week, learn leg locks", required: false, profile_field: "goals" },
        { key: "schedule_preference", label: "Which class times work best for you?", type: "select", options: ["Mornings (Noon classes)", "Evenings", "Weekends", "Flexible / Mix"], required: false, profile_field: "schedule_preference" },
        { key: "frequency_target", label: "How many times per week are you trying to train?", type: "select", options: ["1x/week", "2x/week", "3x/week", "4-5x/week"], required: false, profile_field: "training_frequency_target" },
        { key: "gi_or_nogi", label: "Preference: Gi, No-Gi, or both?", type: "select", options: ["Gi", "No-Gi", "Both"], required: false, profile_field: "gi_or_nogi" },
        { key: "injuries", label: "Any current injuries or limitations?", type: "textarea", required: false, profile_field: "injuries_concerns" },
        { key: "household", label: "Any family members who train or might want to try?", type: "text", placeholder: "Names and relationship", required: false, profile_field: "household_members" },
        { key: "feedback", label: "Anything we could do better?", type: "textarea", required: false, profile_field: "notes" },
      ]),
      "Rodrigo"
    );

    insertTemplate.run(
      "Win-Back Survey",
      "win-back",
      "We miss you! Help us understand how we can improve",
      "student",
      JSON.stringify([
        { key: "quit_reason", label: "What was the main reason you stopped training?", type: "select", options: ["Schedule didn't work", "Financial / Cost", "Injury", "Moved away", "Lost motivation", "Didn't feel welcome", "Switched gyms", "Other"], required: true, profile_field: "quit_reason" },
        { key: "quit_detail", label: "Anything else you'd like to share about why you left?", type: "textarea", required: false, profile_field: "notes" },
        { key: "willing_to_return", label: "Would you consider coming back?", type: "select", options: ["Yes, definitely", "Maybe, depends", "Probably not", "No"], required: true, profile_field: "willing_to_return" },
        { key: "return_conditions", label: "What would make it easier for you to come back?", type: "textarea", placeholder: "e.g., different schedule, lower rate, training partner", required: false, profile_field: "return_conditions" },
        { key: "preferred_contact", label: "Best way to reach you if we have something for you?", type: "select", options: ["Text", "Email", "Phone Call", "Rather not be contacted"], required: true, profile_field: "preferred_contact" },
      ]),
      "Rodrigo"
    );

    insertTemplate.run(
      "Prospect Intake",
      "prospect-intake",
      "Tell us a bit about yourself so we can help you get started",
      "lead",
      JSON.stringify([
        { key: "motivation", label: "What interests you about Brazilian Jiu-Jitsu?", type: "select", options: ["Fitness / Weight Loss", "Self Defense", "Competition", "Fun / Hobby", "Kids Activity", "Saw it online / curious"], required: true, profile_field: "motivation" },
        { key: "prior_training", label: "Any martial arts experience?", type: "select", options: ["None", "Less than 1 year", "1-3 years", "3+ years"], required: true, profile_field: "prior_training" },
        { key: "prior_gym", label: "If yes, where did you train?", type: "text", required: false, profile_field: "prior_gym" },
        { key: "schedule_preference", label: "When would you most likely come to class?", type: "select", options: ["Mornings (Noon)", "Evenings (6pm)", "Weekends", "Not sure"], required: true, profile_field: "schedule_preference" },
        { key: "preferred_contact", label: "How should we follow up with you?", type: "select", options: ["Text", "Email", "Phone Call", "Instagram DM"], required: true, profile_field: "preferred_contact" },
        { key: "instagram_handle", label: "Instagram handle (optional)", type: "text", placeholder: "@yourusername", required: false, profile_field: "instagram_handle" },
        { key: "how_heard", label: "How did you find us?", type: "select", options: ["Google Search", "Instagram/Facebook", "Friend/Referral", "Drove By", "Yelp/Google Reviews", "Other"], required: true, profile_field: "how_heard" },
        { key: "referral_name", label: "If someone referred you, who?", type: "text", required: false, profile_field: "referral_name" },
        { key: "concerns", label: "Any questions or concerns?", type: "textarea", placeholder: "e.g., worried about injuries, schedule, cost", required: false, profile_field: "notes" },
      ]),
      "Rodrigo"
    );
  }

  console.log("Database seeded successfully.");
}
