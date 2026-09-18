ALTER TABLE `platform_settings` ADD `billplz_collection_id` text;--> statement-breakpoint
ALTER TABLE `topup_request` ADD `method` text DEFAULT 'manual' NOT NULL;--> statement-breakpoint
ALTER TABLE `topup_request` ADD `bill_id` text;--> statement-breakpoint
ALTER TABLE `topup_request` ADD `bill_url` text;--> statement-breakpoint
ALTER TABLE `topup_request` ADD `paid_at` integer;--> statement-breakpoint
CREATE UNIQUE INDEX `topup_request_bill_uq` ON `topup_request` (`bill_id`);