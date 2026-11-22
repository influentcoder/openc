CREATE TABLE `events` (
	`session_id` text NOT NULL,
	`seq` integer NOT NULL,
	`timestamp` text NOT NULL,
	`type` text NOT NULL,
	`payload` text NOT NULL,
	PRIMARY KEY(`session_id`, `seq`),
	FOREIGN KEY (`session_id`) REFERENCES `sessions`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `events_type_index` ON `events` (`session_id`,`type`);--> statement-breakpoint
CREATE TABLE `sessions` (
	`id` text PRIMARY KEY NOT NULL,
	`title` text NOT NULL,
	`backend_id` text NOT NULL,
	`model` text NOT NULL,
	`workspace_mode` text NOT NULL,
	`working_directory` text NOT NULL,
	`status` text NOT NULL,
	`process_state` text NOT NULL,
	`error_message` text,
	`backend_session_id` text,
	`created_at` text NOT NULL,
	`last_activity_at` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `settings` (
	`key` text PRIMARY KEY NOT NULL,
	`value` text NOT NULL
);
