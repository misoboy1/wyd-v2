CREATE TABLE "message_recipients" (
	"message_id" integer NOT NULL,
	"kind" text NOT NULL,
	"ref_id" integer NOT NULL,
	"read_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "messages" (
	"id" serial PRIMARY KEY NOT NULL,
	"title" text DEFAULT '' NOT NULL,
	"body" text DEFAULT '' NOT NULL,
	"link" text DEFAULT '' NOT NULL,
	"sender" text DEFAULT '' NOT NULL,
	"sender_id" integer,
	"targets" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "personal_links" (
	"id" serial PRIMARY KEY NOT NULL,
	"kind" text NOT NULL,
	"ref_id" integer NOT NULL,
	"token_hash" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_by" integer,
	"revoked_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "push_subscriptions" (
	"id" serial PRIMARY KEY NOT NULL,
	"endpoint" text NOT NULL,
	"p256dh" text NOT NULL,
	"auth" text NOT NULL,
	"kind" text NOT NULL,
	"ref_id" integer NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"last_ok_at" timestamp with time zone
);
--> statement-breakpoint
ALTER TABLE "message_recipients" ADD CONSTRAINT "message_recipients_message_id_messages_id_fk" FOREIGN KEY ("message_id") REFERENCES "public"."messages"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "message_recipients_pk" ON "message_recipients" USING btree ("message_id","kind","ref_id");--> statement-breakpoint
CREATE INDEX "message_recipients_who_idx" ON "message_recipients" USING btree ("kind","ref_id");--> statement-breakpoint
CREATE INDEX "messages_sender_idx" ON "messages" USING btree ("sender_id");--> statement-breakpoint
CREATE UNIQUE INDEX "personal_links_token_uq" ON "personal_links" USING btree ("token_hash");--> statement-breakpoint
CREATE UNIQUE INDEX "personal_links_active_uq" ON "personal_links" USING btree ("kind","ref_id") WHERE "personal_links"."revoked_at" is null;--> statement-breakpoint
CREATE UNIQUE INDEX "push_subscriptions_endpoint_uq" ON "push_subscriptions" USING btree ("endpoint");--> statement-breakpoint
CREATE INDEX "push_subscriptions_who_idx" ON "push_subscriptions" USING btree ("kind","ref_id");