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
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "candidates_email_unique" UNIQUE("email")
);
--> statement-breakpoint
CREATE TABLE "connections" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"candidate_id" uuid NOT NULL,
	"recruiter_id" uuid NOT NULL,
	"event_id" uuid,
	"method" text DEFAULT 'qr' NOT NULL,
	"consented_at" timestamp DEFAULT now() NOT NULL,
	"status" text DEFAULT 'New' NOT NULL
);
--> statement-breakpoint
CREATE TABLE "events" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"starts_at" timestamp
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
CREATE TABLE "recruiters" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"email" text NOT NULL,
	"password_hash" text,
	"event_id" uuid,
	"connect_token" text NOT NULL,
	CONSTRAINT "recruiters_email_unique" UNIQUE("email"),
	CONSTRAINT "recruiters_connect_token_unique" UNIQUE("connect_token")
);
--> statement-breakpoint
CREATE TABLE "resumes" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"candidate_id" uuid NOT NULL,
	"file_name" text NOT NULL,
	"blob_url" text,
	"extracted_text" text NOT NULL,
	"parsed_json" jsonb,
	"uploaded_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "summaries" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"connection_id" uuid NOT NULL,
	"draft" jsonb NOT NULL,
	"edited" jsonb,
	"edit_count" integer DEFAULT 0 NOT NULL,
	"approval_status" text DEFAULT 'draft' NOT NULL,
	"approved_by" uuid,
	"approved_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "connections" ADD CONSTRAINT "connections_candidate_id_candidates_id_fk" FOREIGN KEY ("candidate_id") REFERENCES "public"."candidates"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "connections" ADD CONSTRAINT "connections_recruiter_id_recruiters_id_fk" FOREIGN KEY ("recruiter_id") REFERENCES "public"."recruiters"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "connections" ADD CONSTRAINT "connections_event_id_events_id_fk" FOREIGN KEY ("event_id") REFERENCES "public"."events"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "metrics_events" ADD CONSTRAINT "metrics_events_connection_id_connections_id_fk" FOREIGN KEY ("connection_id") REFERENCES "public"."connections"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "metrics_events" ADD CONSTRAINT "metrics_events_recruiter_id_recruiters_id_fk" FOREIGN KEY ("recruiter_id") REFERENCES "public"."recruiters"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "observations" ADD CONSTRAINT "observations_connection_id_connections_id_fk" FOREIGN KEY ("connection_id") REFERENCES "public"."connections"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "recruiters" ADD CONSTRAINT "recruiters_event_id_events_id_fk" FOREIGN KEY ("event_id") REFERENCES "public"."events"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "resumes" ADD CONSTRAINT "resumes_candidate_id_candidates_id_fk" FOREIGN KEY ("candidate_id") REFERENCES "public"."candidates"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "summaries" ADD CONSTRAINT "summaries_connection_id_connections_id_fk" FOREIGN KEY ("connection_id") REFERENCES "public"."connections"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "summaries" ADD CONSTRAINT "summaries_approved_by_recruiters_id_fk" FOREIGN KEY ("approved_by") REFERENCES "public"."recruiters"("id") ON DELETE no action ON UPDATE no action;