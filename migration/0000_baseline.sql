CREATE TABLE `account` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`issuer` text NOT NULL,
	`account_id` text NOT NULL,
	`provider_id` text NOT NULL,
	`access_token` text,
	`refresh_token` text,
	`access_token_expires_at` integer,
	`refresh_token_expires_at` integer,
	`scope` text,
	`id_token` text,
	`password` text,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `account_issuer_account_id_uq` ON `account` (`issuer`,`account_id`);--> statement-breakpoint
CREATE TABLE `attendance` (
	`id` text PRIMARY KEY NOT NULL,
	`organization_id` text NOT NULL,
	`employee_id` text NOT NULL,
	`date` text NOT NULL,
	`clock_in` integer NOT NULL,
	`clock_in_status` text NOT NULL,
	`clock_out` integer,
	`clock_out_status` text,
	`site_id` text,
	`lat` real,
	`lng` real,
	`accuracy_m` real,
	`distance_m` real,
	`location_status` text,
	`note` text,
	`clock_out_lat` real,
	`clock_out_lng` real,
	`clock_out_accuracy_m` real,
	`clock_out_distance_m` real,
	`clock_out_location_status` text,
	`clock_out_note` text,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`organization_id`) REFERENCES `organization`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`employee_id`) REFERENCES `employee`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`site_id`) REFERENCES `work_site`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE UNIQUE INDEX `attendance_org_employee_date_uq` ON `attendance` (`organization_id`,`employee_id`,`date`);--> statement-breakpoint
CREATE TABLE `attendance_issue` (
	`id` text PRIMARY KEY NOT NULL,
	`organization_id` text NOT NULL,
	`employee_id` text NOT NULL,
	`date` text NOT NULL,
	`type` text NOT NULL,
	`justification` text,
	`status` text DEFAULT 'open' NOT NULL,
	`review_note` text,
	`verified_by` text,
	`verified_at` integer,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`organization_id`) REFERENCES `organization`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`employee_id`) REFERENCES `employee`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`verified_by`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE UNIQUE INDEX `attendance_issue_uq` ON `attendance_issue` (`employee_id`,`date`,`type`);--> statement-breakpoint
CREATE TABLE `audit_log` (
	`id` text PRIMARY KEY NOT NULL,
	`organization_id` text,
	`user_id` text NOT NULL,
	`target_user_id` text,
	`action` text NOT NULL,
	`detail` text,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`organization_id`) REFERENCES `organization`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`user_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`target_user_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `credit_ledger` (
	`id` text PRIMARY KEY NOT NULL,
	`organization_id` text NOT NULL,
	`type` text NOT NULL,
	`amount_sen` integer NOT NULL,
	`balance_after_sen` integer NOT NULL,
	`note` text,
	`created_by` text,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`organization_id`) REFERENCES `organization`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`created_by`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE TABLE `cron_state` (
	`key` text PRIMARY KEY NOT NULL,
	`value` text,
	`updated_at` integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE `employee` (
	`id` text PRIMARY KEY NOT NULL,
	`organization_id` text NOT NULL,
	`user_id` text,
	`supervisor_id` text,
	`site_id` text,
	`name` text NOT NULL,
	`employee_no` text NOT NULL,
	`position` text,
	`shift` text DEFAULT 'normal' NOT NULL,
	`work_days` text,
	`work_start_minutes` integer,
	`work_end_minutes` integer,
	`grace_minutes` integer,
	`joined_at` integer,
	`is_active` integer DEFAULT true NOT NULL,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`organization_id`) REFERENCES `organization`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`user_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE set null,
	FOREIGN KEY (`supervisor_id`) REFERENCES `employee`(`id`) ON UPDATE no action ON DELETE set null,
	FOREIGN KEY (`site_id`) REFERENCES `work_site`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE UNIQUE INDEX `employee_org_no_uq` ON `employee` (`organization_id`,`employee_no`);--> statement-breakpoint
CREATE UNIQUE INDEX `employee_org_user_uq` ON `employee` (`organization_id`,`user_id`);--> statement-breakpoint
CREATE TABLE `invitation` (
	`id` text PRIMARY KEY NOT NULL,
	`email` text NOT NULL,
	`inviter_id` text NOT NULL,
	`organization_id` text NOT NULL,
	`role` text,
	`status` text NOT NULL,
	`created_at` integer NOT NULL,
	`expires_at` integer NOT NULL,
	FOREIGN KEY (`inviter_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`organization_id`) REFERENCES `organization`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `leave_request` (
	`id` text PRIMARY KEY NOT NULL,
	`organization_id` text NOT NULL,
	`employee_id` text NOT NULL,
	`leave_type_id` text NOT NULL,
	`start_date` text NOT NULL,
	`end_date` text NOT NULL,
	`days` integer NOT NULL,
	`reason` text NOT NULL,
	`status` text DEFAULT 'pending' NOT NULL,
	`decided_by` text,
	`decided_at` integer,
	`decision_reason` text,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`organization_id`) REFERENCES `organization`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`employee_id`) REFERENCES `employee`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`leave_type_id`) REFERENCES `leave_type`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`decided_by`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE TABLE `leave_type` (
	`id` text PRIMARY KEY NOT NULL,
	`organization_id` text NOT NULL,
	`name` text NOT NULL,
	`quota_days` integer,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`organization_id`) REFERENCES `organization`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `leave_type_org_name_uq` ON `leave_type` (`organization_id`,`name`);--> statement-breakpoint
CREATE TABLE `member` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`organization_id` text NOT NULL,
	`role` text NOT NULL,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`organization_id`) REFERENCES `organization`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `notification` (
	`id` text PRIMARY KEY NOT NULL,
	`organization_id` text,
	`user_id` text NOT NULL,
	`title` text NOT NULL,
	`body` text,
	`link_path` text,
	`read_at` integer,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`organization_id`) REFERENCES `organization`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`user_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `org_holiday` (
	`id` text PRIMARY KEY NOT NULL,
	`organization_id` text NOT NULL,
	`name` text NOT NULL,
	`date` text NOT NULL,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`organization_id`) REFERENCES `organization`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `org_holiday_org_date_uq` ON `org_holiday` (`organization_id`,`date`);--> statement-breakpoint
CREATE TABLE `organization` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`slug` text NOT NULL,
	`logo` text,
	`metadata` text,
	`plan` text DEFAULT 'free' NOT NULL,
	`pending_plan` text,
	`balance_sen` integer DEFAULT 0 NOT NULL,
	`paid_until` integer,
	`work_days` text DEFAULT '1,2,3,4,5' NOT NULL,
	`work_start_minutes` integer DEFAULT 540 NOT NULL,
	`work_end_minutes` integer DEFAULT 1080 NOT NULL,
	`grace_minutes` integer DEFAULT 15 NOT NULL,
	`timezone` text DEFAULT 'Asia/Kuala_Lumpur' NOT NULL,
	`geofence_enabled` integer DEFAULT false NOT NULL,
	`email_notifications` integer DEFAULT true NOT NULL,
	`billing_warned_until` integer,
	`created_at` integer NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `organization_slug_unique` ON `organization` (`slug`);--> statement-breakpoint
CREATE TABLE `platform_settings` (
	`id` text PRIMARY KEY NOT NULL,
	`bank_name` text,
	`bank_account` text,
	`account_holder` text,
	`contact_email` text,
	`qr_base64` text,
	`billplz_collection_id` text,
	`billplz_fee_sen` integer,
	`updated_at` integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE `session` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`token` text NOT NULL,
	`expires_at` integer NOT NULL,
	`ip_address` text,
	`user_agent` text,
	`impersonated_by` text,
	`active_organization_id` text,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `session_token_unique` ON `session` (`token`);--> statement-breakpoint
CREATE TABLE `topup_request` (
	`id` text PRIMARY KEY NOT NULL,
	`organization_id` text NOT NULL,
	`amount_sen` integer NOT NULL,
	`payment_ref` text NOT NULL,
	`status` text DEFAULT 'pending' NOT NULL,
	`method` text DEFAULT 'manual' NOT NULL,
	`purpose` text DEFAULT 'credit' NOT NULL,
	`plan_id` text,
	`months` integer,
	`bill_id` text,
	`bill_url` text,
	`bill_amount_sen` integer,
	`paid_at` integer,
	`requested_by` text NOT NULL,
	`decided_by` text,
	`decided_at` integer,
	`decision_note` text,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`organization_id`) REFERENCES `organization`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`requested_by`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`decided_by`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE UNIQUE INDEX `topup_request_pending_uq` ON `topup_request` (`organization_id`) WHERE status = 'pending';--> statement-breakpoint
CREATE UNIQUE INDEX `topup_request_bill_uq` ON `topup_request` (`bill_id`);--> statement-breakpoint
CREATE TABLE `two_factor` (
	`id` text PRIMARY KEY NOT NULL,
	`secret` text NOT NULL,
	`backup_codes` text NOT NULL,
	`user_id` text NOT NULL,
	`verified` integer DEFAULT true,
	`failed_verification_count` integer DEFAULT 0,
	`locked_until` integer,
	FOREIGN KEY (`user_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `user` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`email` text NOT NULL,
	`email_verified` integer NOT NULL,
	`image` text,
	`role` text,
	`banned` integer,
	`ban_reason` text,
	`ban_expires` integer,
	`two_factor_enabled` integer DEFAULT false NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `user_email_unique` ON `user` (`email`);--> statement-breakpoint
CREATE TABLE `verification` (
	`id` text PRIMARY KEY NOT NULL,
	`identifier` text NOT NULL,
	`value` text NOT NULL,
	`expires_at` integer NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE `work_site` (
	`id` text PRIMARY KEY NOT NULL,
	`organization_id` text NOT NULL,
	`name` text NOT NULL,
	`lat` real,
	`lng` real,
	`radius_m` integer DEFAULT 100 NOT NULL,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`organization_id`) REFERENCES `organization`(`id`) ON UPDATE no action ON DELETE cascade
);
