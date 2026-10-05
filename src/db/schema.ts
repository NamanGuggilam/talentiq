import { pgTable, text, integer, timestamp, jsonb, uuid } from "drizzle-orm/pg-core";

export const RECORD_STATUSES = ["New", "Reviewed", "Follow-Up", "Interview Requested", "Closed"] as const;
export type RecordStatus = (typeof RECORD_STATUSES)[number];

export const events = pgTable("events", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: text("name").notNull(),
  startsAt: timestamp("starts_at"),
});

export const recruiters = pgTable("recruiters", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: text("name").notNull(),
  email: text("email").notNull().unique(),
  passwordHash: text("password_hash"),
  eventId: uuid("event_id").references(() => events.id),
  // Encoded in the badge QR code and NFC tag: /c/<connectToken>
  connectToken: text("connect_token").notNull().unique(),
});

export const candidates = pgTable("candidates", {
  id: uuid("id").primaryKey().defaultRandom(),
  firstName: text("first_name").notNull(),
  lastName: text("last_name").notNull(),
  preferredName: text("preferred_name"),
  email: text("email").notNull().unique(),
  phone: text("phone"),
  university: text("university"),
  degreeProgram: text("degree_program"),
  major: text("major"),
  graduationDate: text("graduation_date"),
  gpa: text("gpa"),
  workAuthorization: text("work_authorization"),
  desiredFunction: text("desired_function"),
  technicalInterests: jsonb("technical_interests").$type<string[]>().default([]),
  preferredLocations: jsonb("preferred_locations").$type<string[]>().default([]),
  skills: jsonb("skills").$type<string[]>().default([]),
  coursework: jsonb("coursework").$type<string[]>().default([]),
  projects: jsonb("projects").$type<string[]>().default([]),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const resumes = pgTable("resumes", {
  id: uuid("id").primaryKey().defaultRandom(),
  candidateId: uuid("candidate_id").references(() => candidates.id).notNull(),
  fileName: text("file_name").notNull(),
  blobUrl: text("blob_url"),
  extractedText: text("extracted_text").notNull(),
  parsedJson: jsonb("parsed_json"),
  uploadedAt: timestamp("uploaded_at").defaultNow().notNull(),
});

export const connections = pgTable("connections", {
  id: uuid("id").primaryKey().defaultRandom(),
  candidateId: uuid("candidate_id").references(() => candidates.id).notNull(),
  recruiterId: uuid("recruiter_id").references(() => recruiters.id).notNull(),
  eventId: uuid("event_id").references(() => events.id),
  method: text("method").$type<"qr" | "nfc">().default("qr").notNull(),
  consentedAt: timestamp("consented_at").defaultNow().notNull(),
  status: text("status").$type<RecordStatus>().default("New").notNull(),
});

// Recruiter-entered only. No AI-generated scores anywhere.
export const observations = pgTable("observations", {
  id: uuid("id").primaryKey().defaultRandom(),
  connectionId: uuid("connection_id").references(() => connections.id).notNull().unique(),
  notes: text("notes").default("").notNull(),
  tags: jsonb("tags").$type<string[]>().default([]),
  areasOfInterest: text("areas_of_interest"),
  followUpQuestions: text("follow_up_questions"),
  candidateQuestions: text("candidate_questions"),
  recommendedNextSteps: text("recommended_next_steps"),
  ratingCommunication: integer("rating_communication"),
  ratingTechnical: integer("rating_technical"),
  ratingInterest: integer("rating_interest"),
  captureStartedAt: timestamp("capture_started_at"),
  captureCompletedAt: timestamp("capture_completed_at"),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export type SummaryStatement = { text: string; sources: ("Resume" | "Candidate" | "Recruiter note")[] };
export type SummaryDraft = {
  snapshot: SummaryStatement[];
  keySkills: SummaryStatement[];
  relevantExperience: SummaryStatement[];
  missingInfo: string[];
};

export const summaries = pgTable("summaries", {
  id: uuid("id").primaryKey().defaultRandom(),
  connectionId: uuid("connection_id").references(() => connections.id).notNull(),
  draft: jsonb("draft").$type<SummaryDraft>().notNull(),
  edited: jsonb("edited").$type<SummaryDraft>(),
  editCount: integer("edit_count").default(0).notNull(),
  approvalStatus: text("approval_status").$type<"draft" | "approved" | "rejected">().default("draft").notNull(),
  approvedByRecruiterId: uuid("approved_by").references(() => recruiters.id),
  approvedAt: timestamp("approved_at"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const metricsEvents = pgTable("metrics_events", {
  id: uuid("id").primaryKey().defaultRandom(),
  kind: text("kind").notNull(), // e.g. capture_started, capture_completed, review_task_started
  connectionId: uuid("connection_id").references(() => connections.id),
  recruiterId: uuid("recruiter_id").references(() => recruiters.id),
  payload: jsonb("payload"),
  at: timestamp("at").defaultNow().notNull(),
});

