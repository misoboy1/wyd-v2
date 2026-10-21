CREATE TABLE "team_chats" (
	"id" serial PRIMARY KEY NOT NULL,
	"team" text NOT NULL,
	"url" text NOT NULL,
	"code" text DEFAULT '' NOT NULL,
	"version" integer DEFAULT 1 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_by" integer
);
--> statement-breakpoint
CREATE UNIQUE INDEX "team_chats_team_uq" ON "team_chats" USING btree ("team");