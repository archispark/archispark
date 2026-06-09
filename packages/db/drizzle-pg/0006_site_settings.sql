CREATE TABLE IF NOT EXISTS "site_settings" (
  "id" integer PRIMARY KEY,
  "login_message" text,
  "login_message_enabled" boolean NOT NULL DEFAULT false,
  "banner_message" text,
  "banner_message_enabled" boolean NOT NULL DEFAULT false,
  "updated_at" integer NOT NULL DEFAULT extract(epoch from now())::int
);
--> statement-breakpoint
INSERT INTO "site_settings" ("id") VALUES (1) ON CONFLICT DO NOTHING;
