CREATE TABLE "dashboard_revisions" (
	"id" serial PRIMARY KEY NOT NULL,
	"dashboard_id" integer NOT NULL,
	"revision" integer NOT NULL,
	"definition" jsonb NOT NULL,
	"created_by_id" text NOT NULL,
	"created_at" integer DEFAULT extract(epoch from now())::int NOT NULL
);
--> statement-breakpoint
CREATE TABLE "dashboards" (
	"id" serial PRIMARY KEY NOT NULL,
	"organization_id" integer NOT NULL,
	"dashboard_id" text NOT NULL,
	"is_provisioned" boolean DEFAULT false NOT NULL,
	"latest_revision" integer NOT NULL,
	"created_by_id" text NOT NULL,
	"created_at" integer DEFAULT extract(epoch from now())::int NOT NULL,
	"deleted_at" integer
);
--> statement-breakpoint
ALTER TABLE "dashboard_revisions" ADD CONSTRAINT "dashboard_revisions_dashboard_id_dashboards_id_fk" FOREIGN KEY ("dashboard_id") REFERENCES "public"."dashboards"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "dashboards" ADD CONSTRAINT "dashboards_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "dashboard_revisions_dashboard_rev_uniq" ON "dashboard_revisions" USING btree ("dashboard_id","revision");--> statement-breakpoint
CREATE INDEX "dashboard_revisions_dashboard_idx" ON "dashboard_revisions" USING btree ("dashboard_id");--> statement-breakpoint
CREATE UNIQUE INDEX "dashboards_org_dashboard_id_uniq" ON "dashboards" USING btree ("organization_id","dashboard_id");--> statement-breakpoint
CREATE INDEX "dashboards_org_idx" ON "dashboards" USING btree ("organization_id");