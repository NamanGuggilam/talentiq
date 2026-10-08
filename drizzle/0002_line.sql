CREATE TABLE "queue_entries" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"recruiter_id" uuid NOT NULL,
	"candidate_id" uuid NOT NULL,
	"status" text DEFAULT 'waiting' NOT NULL,
	"joined_at" timestamp NOT NULL,
	"called_at" timestamp,
	"done_at" timestamp
);
--> statement-breakpoint
ALTER TABLE "recruiters" ADD COLUMN "queue_open" boolean DEFAULT true NOT NULL;--> statement-breakpoint
ALTER TABLE "recruiters" ADD COLUMN "queue_max" integer DEFAULT 25 NOT NULL;--> statement-breakpoint
ALTER TABLE "recruiters" ADD COLUMN "minutes_per" integer DEFAULT 4 NOT NULL;--> statement-breakpoint
ALTER TABLE "queue_entries" ADD CONSTRAINT "queue_entries_recruiter_id_recruiters_id_fk" FOREIGN KEY ("recruiter_id") REFERENCES "public"."recruiters"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "queue_entries" ADD CONSTRAINT "queue_entries_candidate_id_candidates_id_fk" FOREIGN KEY ("candidate_id") REFERENCES "public"."candidates"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "queue_recruiter_idx" ON "queue_entries" USING btree ("recruiter_id","status");--> statement-breakpoint
CREATE INDEX "queue_candidate_idx" ON "queue_entries" USING btree ("candidate_id");