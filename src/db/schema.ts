import { pgTable, text, integer, boolean, timestamp, jsonb, uuid, uniqueIndex, index, primaryKey } from "drizzle-orm/pg-core";

export const RECORD_STATUSES = ["New", "Reviewed", "Follow-Up", "Interview Requested", "Closed"] as const;
export type RecordStatus = (typeof RECORD_STATUSES)[number];

export const CLAIM_STATUSES = ["verified", "partial", "discrepancy", "not_found", "not_checked"] as const;
export type ClaimStatus = (typeof CLAIM_STATUSES)[number];

export const LINK_KINDS = ["github", "devpost", "credly", "site"] as const;
export type LinkKind = (typeof LINK_KINDS)[number];
export type CandidateLinks = Partial<Record<LinkKind, string>>;
// Evidence can come from a page the student linked or from a file they uploaded alongside their resume.
export type SourceKind = LinkKind | "file";

export const events = pgTable("events", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: text("name").notNull(),
  company: text("company").default("J.B. Hunt").notNull(),
  startsAt: timestamp("starts_at"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const recruiters = pgTable("recruiters", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: text("name").notNull(),
  title: text("title"),
  email: text("email").notNull().unique(),
  passwordHash: text("password_hash"),
  role: text("role").$type<"recruiter" | "coordinator">().default("recruiter").notNull(),
  eventId: uuid("event_id").references(() => events.id),
  // Encoded in the badge QR code and NFC tag: /c/<connectToken>
  connectToken: text("connect_token").notNull().unique(),
  // Topics this recruiter covers, in their own words. Students are matched to a line on this.
  focus: text("focus").default("").notNull(),
  // Virtual line settings, set by the recruiter.
  queueOpen: boolean("queue_open").default(true).notNull(),
  queueMax: integer("queue_max").default(25).notNull(),
  minutesPer: integer("minutes_per").default(4).notNull(),
  disabledAt: timestamp("disabled_at"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
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
  links: jsonb("links").$type<CandidateLinks>().default({}),
  scrapeConsentAt: timestamp("scrape_consent_at"),
  // scrypt hash of the one-time recovery code shown at signup
  recoveryHash: text("recovery_hash"),
  evidenceState: text("evidence_state").$type<"idle" | "running" | "done" | "failed">().default("idle").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

// Opaque session tokens for both sides. Only the SHA-256 of the token is stored.
export const sessions = pgTable("sessions", {
  tokenHash: text("token_hash").primaryKey(),
  kind: text("kind").$type<"recruiter" | "candidate">().notNull(),
  subjectId: uuid("subject_id").notNull(),
  expiresAt: timestamp("expires_at").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
}, (t) => [index("sessions_subject_idx").on(t.subjectId)]);

export const resumes = pgTable("resumes", {
  id: uuid("id").primaryKey().defaultRandom(),
  candidateId: uuid("candidate_id").references(() => candidates.id, { onDelete: "cascade" }).notNull(),
  fileName: text("file_name").notNull(),
  mime: text("mime").default("text/plain").notNull(),
  size: integer("size").default(0).notNull(),
  // Original upload, base64. Served only through an authorised route.
  fileB64: text("file_b64"),
  extractedText: text("extracted_text").notNull(),
  uploadedAt: timestamp("uploaded_at").defaultNow().notNull(),
}, (t) => [index("resumes_candidate_idx").on(t.candidateId)]);

// Other files a student uploads with their resume: transcripts, certificates, project write-ups.
// Their text is extracted and used as evidence when resume claims are checked.
export const documents = pgTable("documents", {
  id: uuid("id").primaryKey().defaultRandom(),
  candidateId: uuid("candidate_id").references(() => candidates.id, { onDelete: "cascade" }).notNull(),
  fileName: text("file_name").notNull(),
  mime: text("mime").notNull(),
  size: integer("size").default(0).notNull(),
  fileB64: text("file_b64"),
  extractedText: text("extracted_text").notNull(),
  uploadedAt: timestamp("uploaded_at").defaultNow().notNull(),
}, (t) => [index("documents_candidate_idx").on(t.candidateId)]);

export const connections = pgTable("connections", {
  id: uuid("id").primaryKey().defaultRandom(),
  candidateId: uuid("candidate_id").references(() => candidates.id, { onDelete: "cascade" }).notNull(),
  recruiterId: uuid("recruiter_id").references(() => recruiters.id).notNull(),
  eventId: uuid("event_id").references(() => events.id),
  method: text("method").$type<"qr" | "nfc" | "tap" | "line">().default("qr").notNull(),
  consentedAt: timestamp("consented_at").defaultNow().notNull(),
  status: text("status").$type<RecordStatus>().default("New").notNull(),
  statusSetBy: uuid("status_set_by").references(() => recruiters.id),
  statusSetAt: timestamp("status_set_at"),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
}, (t) => [uniqueIndex("connections_pair_idx").on(t.candidateId, t.recruiterId), index("connections_event_idx").on(t.eventId)]);

// Recruiter-entered only. Ratings are a human judgement and are never sent to the AI.
export const observations = pgTable("observations", {
  id: uuid("id").primaryKey().defaultRandom(),
  connectionId: uuid("connection_id").references(() => connections.id, { onDelete: "cascade" }).notNull().unique(),
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

/** Facts pulled out of a page the candidate linked. `lines` is the searchable text used to confirm quotes. */
export type ExtractedFacts = {
  title?: string;
  languages?: string[];
  repos?: { name: string; description?: string; language?: string; created?: string; pushed?: string; stars?: number }[];
  projects?: { title: string; event?: string; prize?: string; teamSize?: number }[];
  badges?: { name: string; issuer?: string; issued?: string; expires?: string }[];
  lines: string[];
};

export const evidenceSources = pgTable("evidence_sources", {
  id: uuid("id").primaryKey().defaultRandom(),
  candidateId: uuid("candidate_id").references(() => candidates.id, { onDelete: "cascade" }).notNull(),
  kind: text("kind").$type<SourceKind>().notNull(),
  url: text("url").notNull(),
  fetchStatus: text("fetch_status").$type<"pending" | "ok" | "failed" | "blocked">().default("pending").notNull(),
  fetchedAt: timestamp("fetched_at"),
  extracted: jsonb("extracted").$type<ExtractedFacts>(),
  error: text("error"),
}, (t) => [index("evidence_candidate_idx").on(t.candidateId)]);

export const claims = pgTable("claims", {
  id: uuid("id").primaryKey().defaultRandom(),
  candidateId: uuid("candidate_id").references(() => candidates.id, { onDelete: "cascade" }).notNull(),
  kind: text("kind").$type<"resume_claim" | "found_not_on_resume">().default("resume_claim").notNull(),
  type: text("type").$type<"skill" | "project" | "award" | "certification" | "experience">().notNull(),
  text: text("text").notNull(),
  resumeQuote: text("resume_quote"),
  status: text("status").$type<ClaimStatus>().default("not_checked").notNull(),
  evidenceSourceId: uuid("evidence_source_id").references(() => evidenceSources.id, { onDelete: "set null" }),
  evidenceQuote: text("evidence_quote"),
  explanation: text("explanation"),
  suggestedQuestion: text("suggested_question"),
  hiddenByRecruiterId: uuid("hidden_by").references(() => recruiters.id),
  position: integer("position").default(0).notNull(),
}, (t) => [index("claims_candidate_idx").on(t.candidateId)]);

export const SOURCE_LABELS = ["Resume", "Candidate", "Recruiter note", "Linked page"] as const;
export type SourceLabel = (typeof SOURCE_LABELS)[number];
export type SummaryStatement = { text: string; sources: SourceLabel[]; url?: string; edited?: boolean };
export type SummaryDraft = {
  snapshot: SummaryStatement[];
  keySkills: SummaryStatement[];
  relevantExperience: SummaryStatement[];
  missingInfo: string[];
};
export type RejectedStatement = { text: string; sources: string[]; reason: string };

export const summaries = pgTable("summaries", {
  id: uuid("id").primaryKey().defaultRandom(),
  connectionId: uuid("connection_id").references(() => connections.id, { onDelete: "cascade" }).notNull().unique(),
  draft: jsonb("draft").$type<SummaryDraft>().notNull(),
  edited: jsonb("edited").$type<SummaryDraft>(),
  rejectedStatements: jsonb("rejected_statements").$type<RejectedStatement[]>().default([]),
  provider: text("provider").default("mock").notNull(),
  sourcesHash: text("sources_hash"),
  editCount: integer("edit_count").default(0).notNull(),
  approvalStatus: text("approval_status").$type<"draft" | "approved" | "rejected">().default("draft").notNull(),
  approvedByRecruiterId: uuid("approved_by").references(() => recruiters.id),
  approvedAt: timestamp("approved_at"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const tags = pgTable("tags", {
  id: uuid("id").primaryKey().defaultRandom(),
  eventId: uuid("event_id").references(() => events.id, { onDelete: "cascade" }).notNull(),
  label: text("label").notNull(),
  position: integer("position").default(0).notNull(),
}, (t) => [uniqueIndex("tags_event_label_idx").on(t.eventId, t.label)]);

export const metricsEvents = pgTable("metrics_events", {
  id: uuid("id").primaryKey().defaultRandom(),
  kind: text("kind").notNull(),
  connectionId: uuid("connection_id"),
  recruiterId: uuid("recruiter_id"),
  payload: jsonb("payload"),
  at: timestamp("at").defaultNow().notNull(),
}, (t) => [index("metrics_kind_idx").on(t.kind)]);

export const studySessions = pgTable("study_sessions", {
  id: uuid("id").primaryKey().defaultRandom(),
  eventId: uuid("event_id").references(() => events.id, { onDelete: "cascade" }),
  participantCode: text("participant_code").notNull(),
  condition: text("condition").$type<"paper" | "talentiq">().notNull(),
  orderIndex: integer("order_index").default(1).notNull(),
  candidateSet: text("candidate_set").default("A").notNull(),
  startedAt: timestamp("started_at"),
  endedAt: timestamp("ended_at"),
  recordsCompleted: integer("records_completed"),
  confidence: integer("confidence"),
  notes: text("notes"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// Synthetic public profile pages served at /mock/<kind>/<handle> so the scraper has something to read in the demo.
export const mockProfiles = pgTable("mock_profiles", {
  kind: text("kind").$type<LinkKind>().notNull(),
  handle: text("handle").notNull(),
  displayName: text("display_name").notNull(),
  facts: jsonb("facts").$type<ExtractedFacts>().notNull(),
}, (t) => [primaryKey({ columns: [t.kind, t.handle] })]);

export const QUEUE_ACTIVE = ["waiting", "called"] as const;
// A student's place in one recruiter's virtual line. Scanning the badge QR code joins it; tapping phones ends it.
export const queueEntries = pgTable("queue_entries", {
  id: uuid("id").primaryKey().defaultRandom(),
  recruiterId: uuid("recruiter_id").references(() => recruiters.id, { onDelete: "cascade" }).notNull(),
  candidateId: uuid("candidate_id").references(() => candidates.id, { onDelete: "cascade" }).notNull(),
  status: text("status").$type<"waiting" | "called" | "served" | "left" | "skipped">().default("waiting").notNull(),
  joinedAt: timestamp("joined_at").notNull(),
  calledAt: timestamp("called_at"),
  doneAt: timestamp("done_at"),
}, (t) => [index("queue_recruiter_idx").on(t.recruiterId, t.status), index("queue_candidate_idx").on(t.candidateId)]);

// One row each time a phone is bumped (or its Tap button pressed). A student's tap and a recruiter's tap that land
// within a few seconds of each other are offered to the student as a match. Rows are deleted after a minute.
export const taps = pgTable("taps", {
  id: uuid("id").primaryKey().defaultRandom(),
  kind: text("kind").$type<"recruiter" | "candidate">().notNull(),
  subjectId: uuid("subject_id").notNull(),
  at: timestamp("at").defaultNow().notNull(),
}, (t) => [index("taps_at_idx").on(t.at)]);

// Fixed-window counters for throttling logins, signups, uploads and AI calls.
export const rateLimits = pgTable("rate_limits", {
  key: text("key").primaryKey(),
  count: integer("count").default(0).notNull(),
  windowStart: timestamp("window_start").defaultNow().notNull(),
});
