CREATE TABLE "candidates" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"first_name" text NOT NULL,
	"last_name" text NOT NULL,
	"preferred_name" text,
	"email" text NOT NULL,
	"phone" text,
	"university" text,
	"degree_program" text,
	"major" text,
	"graduation_date" text,
	"gpa" text,
	"work_authorization" text,
	"desired_function" text,
	"technical_interests" jsonb DEFAULT '[]'::jsonb,
	"preferred_locations" jsonb DEFAULT '[]'::jsonb,
	"skills" jsonb DEFAULT '[]'::jsonb,
	"coursework" jsonb DEFAULT '[]'::jsonb,
	"projects" jsonb DEFAULT '[]'::jsonb,
	"links" jsonb DEFAULT '{}'::jsonb,
	"scrape_consent_at" timestamp,
	"recovery_hash" text,
	"evidence_state" text DEFAULT 'idle' NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "candidates_email_unique" UNIQUE("email")
);
--> statement-breakpoint
CREATE TABLE "claims" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"candidate_id" uuid NOT NULL,
	"kind" text DEFAULT 'resume_claim' NOT NULL,
	"type" text NOT NULL,
	"text" text NOT NULL,
	"resume_quote" text,
	"status" text DEFAULT 'not_checked' NOT NULL,
	"evidence_source_id" uuid,
	"evidence_quote" text,
	"explanation" text,
	"suggested_question" text,
	"hidden_by" uuid,
	"position" integer DEFAULT 0 NOT NULL
);
--> statement-breakpoint
CREATE TABLE "connections" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"candidate_id" uuid NOT NULL,
	"recruiter_id" uuid NOT NULL,
	"event_id" uuid,
	"method" text DEFAULT 'qr' NOT NULL,
	"consented_at" timestamp DEFAULT now() NOT NULL,
	"status" text DEFAULT 'New' NOT NULL,
	"status_set_by" uuid,
	"status_set_at" timestamp,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "events" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"company" text DEFAULT 'J.B. Hunt' NOT NULL,
	"starts_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "evidence_sources" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"candidate_id" uuid NOT NULL,
	"kind" text NOT NULL,
	"url" text NOT NULL,
	"fetch_status" text DEFAULT 'pending' NOT NULL,
	"fetched_at" timestamp,
	"extracted" jsonb,
	"error" text
);
--> statement-breakpoint
CREATE TABLE "metrics_events" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"kind" text NOT NULL,
	"connection_id" uuid,
	"recruiter_id" uuid,
	"payload" jsonb,
	"at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "mock_profiles" (
	"kind" text NOT NULL,
	"handle" text NOT NULL,
	"display_name" text NOT NULL,
	"facts" jsonb NOT NULL,
	CONSTRAINT "mock_profiles_kind_handle_pk" PRIMARY KEY("kind","handle")
);
--> statement-breakpoint
CREATE TABLE "observations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"connection_id" uuid NOT NULL,
	"notes" text DEFAULT '' NOT NULL,
	"tags" jsonb DEFAULT '[]'::jsonb,
	"areas_of_interest" text,
	"follow_up_questions" text,
	"candidate_questions" text,
	"recommended_next_steps" text,
	"rating_communication" integer,
	"rating_technical" integer,
	"rating_interest" integer,
	"capture_started_at" timestamp,
	"capture_completed_at" timestamp,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "observations_connection_id_unique" UNIQUE("connection_id")
);
--> statement-breakpoint
CREATE TABLE "rate_limits" (
	"key" text PRIMARY KEY NOT NULL,
	"count" integer DEFAULT 0 NOT NULL,
	"window_start" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "recruiters" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"title" text,
	"email" text NOT NULL,
	"password_hash" text,
	"role" text DEFAULT 'recruiter' NOT NULL,
	"event_id" uuid,
	"connect_token" text NOT NULL,
	"disabled_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "recruiters_email_unique" UNIQUE("email"),
	CONSTRAINT "recruiters_connect_token_unique" UNIQUE("connect_token")
);
--> statement-breakpoint
CREATE TABLE "resumes" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"candidate_id" uuid NOT NULL,
	"file_name" text NOT NULL,
	"mime" text DEFAULT 'text/plain' NOT NULL,
	"size" integer DEFAULT 0 NOT NULL,
	"file_b64" text,
	"extracted_text" text NOT NULL,
	"uploaded_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "sessions" (
	"token_hash" text PRIMARY KEY NOT NULL,
	"kind" text NOT NULL,
	"subject_id" uuid NOT NULL,
	"expires_at" timestamp NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "study_sessions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"event_id" uuid,
	"participant_code" text NOT NULL,
	"condition" text NOT NULL,
	"order_index" integer DEFAULT 1 NOT NULL,
	"candidate_set" text DEFAULT 'A' NOT NULL,
	"started_at" timestamp,
	"ended_at" timestamp,
	"records_completed" integer,
	"confidence" integer,
	"notes" text,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "summaries" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"connection_id" uuid NOT NULL,
	"draft" jsonb NOT NULL,
	"edited" jsonb,
	"rejected_statements" jsonb DEFAULT '[]'::jsonb,
	"provider" text DEFAULT 'mock' NOT NULL,
	"sources_hash" text,
	"edit_count" integer DEFAULT 0 NOT NULL,
	"approval_status" text DEFAULT 'draft' NOT NULL,
	"approved_by" uuid,
	"approved_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "summaries_connection_id_unique" UNIQUE("connection_id")
);
--> statement-breakpoint
CREATE TABLE "tags" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"event_id" uuid NOT NULL,
	"label" text NOT NULL,
	"position" integer DEFAULT 0 NOT NULL
);
--> statement-breakpoint
ALTER TABLE "claims" ADD CONSTRAINT "claims_candidate_id_candidates_id_fk" FOREIGN KEY ("candidate_id") REFERENCES "public"."candidates"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "claims" ADD CONSTRAINT "claims_evidence_source_id_evidence_sources_id_fk" FOREIGN KEY ("evidence_source_id") REFERENCES "public"."evidence_sources"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "claims" ADD CONSTRAINT "claims_hidden_by_recruiters_id_fk" FOREIGN KEY ("hidden_by") REFERENCES "public"."recruiters"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "connections" ADD CONSTRAINT "connections_candidate_id_candidates_id_fk" FOREIGN KEY ("candidate_id") REFERENCES "public"."candidates"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "connections" ADD CONSTRAINT "connections_recruiter_id_recruiters_id_fk" FOREIGN KEY ("recruiter_id") REFERENCES "public"."recruiters"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "connections" ADD CONSTRAINT "connections_event_id_events_id_fk" FOREIGN KEY ("event_id") REFERENCES "public"."events"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "connections" ADD CONSTRAINT "connections_status_set_by_recruiters_id_fk" FOREIGN KEY ("status_set_by") REFERENCES "public"."recruiters"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "evidence_sources" ADD CONSTRAINT "evidence_sources_candidate_id_candidates_id_fk" FOREIGN KEY ("candidate_id") REFERENCES "public"."candidates"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "observations" ADD CONSTRAINT "observations_connection_id_connections_id_fk" FOREIGN KEY ("connection_id") REFERENCES "public"."connections"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "recruiters" ADD CONSTRAINT "recruiters_event_id_events_id_fk" FOREIGN KEY ("event_id") REFERENCES "public"."events"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "resumes" ADD CONSTRAINT "resumes_candidate_id_candidates_id_fk" FOREIGN KEY ("candidate_id") REFERENCES "public"."candidates"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "study_sessions" ADD CONSTRAINT "study_sessions_event_id_events_id_fk" FOREIGN KEY ("event_id") REFERENCES "public"."events"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "summaries" ADD CONSTRAINT "summaries_connection_id_connections_id_fk" FOREIGN KEY ("connection_id") REFERENCES "public"."connections"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "summaries" ADD CONSTRAINT "summaries_approved_by_recruiters_id_fk" FOREIGN KEY ("approved_by") REFERENCES "public"."recruiters"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tags" ADD CONSTRAINT "tags_event_id_events_id_fk" FOREIGN KEY ("event_id") REFERENCES "public"."events"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "claims_candidate_idx" ON "claims" USING btree ("candidate_id");--> statement-breakpoint
CREATE UNIQUE INDEX "connections_pair_idx" ON "connections" USING btree ("candidate_id","recruiter_id");--> statement-breakpoint
CREATE INDEX "connections_event_idx" ON "connections" USING btree ("event_id");--> statement-breakpoint
CREATE INDEX "evidence_candidate_idx" ON "evidence_sources" USING btree ("candidate_id");--> statement-breakpoint
CREATE INDEX "metrics_kind_idx" ON "metrics_events" USING btree ("kind");--> statement-breakpoint
CREATE INDEX "resumes_candidate_idx" ON "resumes" USING btree ("candidate_id");--> statement-breakpoint
CREATE INDEX "sessions_subject_idx" ON "sessions" USING btree ("subject_id");--> statement-breakpoint
CREATE UNIQUE INDEX "tags_event_label_idx" ON "tags" USING btree ("event_id","label");