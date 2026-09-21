ALTER TABLE `booking` ADD `payment_method` text DEFAULT 'none' NOT NULL;--> statement-breakpoint
ALTER TABLE `booking` ADD `total_cents` integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE `booking` ADD `due_now_cents` integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE `event_type` ADD `accept_cash` integer DEFAULT false NOT NULL;