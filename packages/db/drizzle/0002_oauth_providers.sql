CREATE TABLE IF NOT EXISTS `oauth_providers` (
	`id` text PRIMARY KEY NOT NULL,
	`provider_id` text NOT NULL,
	`type` text NOT NULL,
	`name` text NOT NULL,
	`client_id` text NOT NULL,
	`client_secret` text NOT NULL,
	`issuer_url` text,
	`tenant_id` text,
	`enabled` integer NOT NULL DEFAULT true,
	`created_at` integer NOT NULL DEFAULT (unixepoch())
);
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS `oauth_providers_provider_id_uniq` ON `oauth_providers` (`provider_id`);
