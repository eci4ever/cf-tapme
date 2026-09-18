ALTER TABLE `topup_request` ADD `purpose` text DEFAULT 'credit' NOT NULL;--> statement-breakpoint
ALTER TABLE `topup_request` ADD `plan_id` text;--> statement-breakpoint
ALTER TABLE `topup_request` ADD `months` integer;