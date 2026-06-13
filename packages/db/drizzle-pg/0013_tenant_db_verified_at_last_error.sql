ALTER TABLE "tenant_databases" ADD COLUMN "verified_at" timestamp;--> statement-breakpoint
ALTER TABLE "tenant_databases" ADD COLUMN "last_error" text;
