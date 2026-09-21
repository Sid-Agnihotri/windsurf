ALTER TABLE `booking` ADD `manage_token` text;--> statement-breakpoint
CREATE UNIQUE INDEX `booking_manage_token_uidx` ON `booking` (`manage_token`);--> statement-breakpoint
ALTER TABLE `host_settings` ADD `change_notice_hours` integer DEFAULT 24 NOT NULL;