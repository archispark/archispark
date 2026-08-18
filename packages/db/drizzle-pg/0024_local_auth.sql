CREATE TABLE "users" (
	"id" text PRIMARY KEY NOT NULL,
	"username" text NOT NULL,
	"email" text NOT NULL,
	"password_hash" text NOT NULL,
	"display_name" text,
	"role" text DEFAULT 'user' NOT NULL,
	"enabled" boolean DEFAULT true NOT NULL,
	"email_verified" boolean DEFAULT false NOT NULL,
	"must_change_password" boolean DEFAULT false NOT NULL,
	"created_at" integer DEFAULT extract(epoch from now())::int NOT NULL,
	"updated_at" integer DEFAULT extract(epoch from now())::int NOT NULL,
	"last_login_at" integer
);
--> statement-breakpoint
CREATE TABLE "local_refresh_tokens" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"token_hash" text NOT NULL,
	"created_at" integer DEFAULT extract(epoch from now())::int NOT NULL,
	"expires_at" integer NOT NULL,
	"revoked_at" integer,
	"replaced_by_id" integer,
	"user_agent" text,
	"ip_address" text
);
--> statement-breakpoint
CREATE TABLE "local_password_reset_tokens" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"token_hash" text NOT NULL,
	"created_at" integer DEFAULT extract(epoch from now())::int NOT NULL,
	"expires_at" integer NOT NULL,
	"used_at" integer
);
--> statement-breakpoint
CREATE TABLE "local_login_attempts" (
	"id" serial PRIMARY KEY NOT NULL,
	"identifier" text NOT NULL,
	"created_at" integer DEFAULT extract(epoch from now())::int NOT NULL
);
--> statement-breakpoint
ALTER TABLE "local_refresh_tokens" ADD CONSTRAINT "local_refresh_tokens_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "local_password_reset_tokens" ADD CONSTRAINT "local_password_reset_tokens_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "users_username_uniq" ON "users" USING btree ("username");--> statement-breakpoint
CREATE UNIQUE INDEX "users_email_uniq" ON "users" USING btree ("email");--> statement-breakpoint
CREATE UNIQUE INDEX "local_refresh_tokens_token_hash_uniq" ON "local_refresh_tokens" USING btree ("token_hash");--> statement-breakpoint
CREATE INDEX "local_refresh_tokens_user_idx" ON "local_refresh_tokens" USING btree ("user_id");--> statement-breakpoint
CREATE UNIQUE INDEX "local_password_reset_tokens_token_hash_uniq" ON "local_password_reset_tokens" USING btree ("token_hash");--> statement-breakpoint
CREATE INDEX "local_login_attempts_identifier_idx" ON "local_login_attempts" USING btree ("identifier","created_at");
