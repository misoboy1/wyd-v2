CREATE SEQUENCE "public"."homestay_hid_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 9223372036854775807 START WITH 1 CACHE 1;--> statement-breakpoint
CREATE SEQUENCE "public"."visitor_pid_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 9223372036854775807 START WITH 1 CACHE 1;--> statement-breakpoint
CREATE TABLE "audit_log" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" integer,
	"table_name" text NOT NULL,
	"row_id" integer,
	"action" text NOT NULL,
	"before" jsonb,
	"after" jsonb,
	"at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "departments" (
	"id" serial PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"kind" text DEFAULT '분과' NOT NULL,
	"task" text DEFAULT '' NOT NULL,
	"key" boolean DEFAULT false NOT NULL,
	"sort" integer DEFAULT 0 NOT NULL,
	"version" integer DEFAULT 1 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_by" integer
);
--> statement-breakpoint
CREATE TABLE "facilities" (
	"id" serial PRIMARY KEY NOT NULL,
	"rno" text DEFAULT '' NOT NULL,
	"name" text NOT NULL,
	"type" text DEFAULT '' NOT NULL,
	"area" text DEFAULT '' NOT NULL,
	"cap" integer,
	"ac" text DEFAULT '' NOT NULL,
	"outlet" text DEFAULT '' NOT NULL,
	"wheel" text DEFAULT '' NOT NULL,
	"gender" text DEFAULT '공용' NOT NULL,
	"status" text DEFAULT '가용' NOT NULL,
	"note" text DEFAULT '' NOT NULL,
	"version" integer DEFAULT 1 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_by" integer
);
--> statement-breakpoint
CREATE TABLE "gori" (
	"id" serial PRIMARY KEY NOT NULL,
	"date" text NOT NULL,
	"org" text DEFAULT '' NOT NULL,
	"rep" text DEFAULT '' NOT NULL,
	"note" text DEFAULT '' NOT NULL,
	"photo" text DEFAULT '' NOT NULL,
	"version" integer DEFAULT 1 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_by" integer
);
--> statement-breakpoint
CREATE TABLE "homestays" (
	"id" serial PRIMARY KEY NOT NULL,
	"hid" text NOT NULL,
	"host" text NOT NULL,
	"zone" text DEFAULT '' NOT NULL,
	"addr" text DEFAULT '' NOT NULL,
	"tel" text DEFAULT '' NOT NULL,
	"m_adult" integer,
	"f_adult" integer,
	"f_stu" integer,
	"m_stu" integer,
	"f_yng" integer,
	"m_yng" integer,
	"lang" text DEFAULT '' NOT NULL,
	"cap" integer,
	"period" text DEFAULT '' NOT NULL,
	"match" text DEFAULT '' NOT NULL,
	"status" text DEFAULT '제안' NOT NULL,
	"note" text DEFAULT '' NOT NULL,
	"version" integer DEFAULT 1 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_by" integer
);
--> statement-breakpoint
CREATE TABLE "notices" (
	"id" serial PRIMARY KEY NOT NULL,
	"date" text DEFAULT '' NOT NULL,
	"title" text DEFAULT '' NOT NULL,
	"body" text DEFAULT '' NOT NULL,
	"author" text DEFAULT '' NOT NULL,
	"version" integer DEFAULT 1 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_by" integer
);
--> statement-breakpoint
CREATE TABLE "officers" (
	"id" serial PRIMARY KEY NOT NULL,
	"slot" text DEFAULT '' NOT NULL,
	"name" text DEFAULT '' NOT NULL,
	"tel" text DEFAULT '' NOT NULL,
	"note" text DEFAULT '' NOT NULL,
	"sort" integer DEFAULT 0 NOT NULL,
	"version" integer DEFAULT 1 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_by" integer
);
--> statement-breakpoint
CREATE TABLE "places" (
	"id" serial PRIMARY KEY NOT NULL,
	"cat" text DEFAULT '기타' NOT NULL,
	"name" text DEFAULT '' NOT NULL,
	"name_en" text DEFAULT '' NOT NULL,
	"addr" text DEFAULT '' NOT NULL,
	"addr_en" text DEFAULT '' NOT NULL,
	"query" text DEFAULT '' NOT NULL,
	"desc" text DEFAULT '' NOT NULL,
	"desc_en" text DEFAULT '' NOT NULL,
	"sort" integer DEFAULT 0 NOT NULL,
	"version" integer DEFAULT 1 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_by" integer
);
--> statement-breakpoint
CREATE TABLE "posts" (
	"id" serial PRIMARY KEY NOT NULL,
	"date" text DEFAULT '' NOT NULL,
	"title" text DEFAULT '' NOT NULL,
	"body" text DEFAULT '' NOT NULL,
	"author" text DEFAULT '' NOT NULL,
	"author_id" integer,
	"version" integer DEFAULT 1 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_by" integer
);
--> statement-breakpoint
CREATE TABLE "prep" (
	"id" serial PRIMARY KEY NOT NULL,
	"phase" text DEFAULT '' NOT NULL,
	"title" text DEFAULT '' NOT NULL,
	"detail" text DEFAULT '' NOT NULL,
	"ref" text DEFAULT '' NOT NULL,
	"done" boolean DEFAULT false NOT NULL,
	"sort" integer DEFAULT 0 NOT NULL,
	"version" integer DEFAULT 1 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_by" integer
);
--> statement-breakpoint
CREATE TABLE "qna" (
	"id" serial PRIMARY KEY NOT NULL,
	"date" text DEFAULT '' NOT NULL,
	"author" text DEFAULT '' NOT NULL,
	"q" text DEFAULT '' NOT NULL,
	"a" text DEFAULT '' NOT NULL,
	"answered" boolean DEFAULT false NOT NULL,
	"version" integer DEFAULT 1 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_by" integer
);
--> statement-breakpoint
CREATE TABLE "schedule" (
	"id" serial PRIMARY KEY NOT NULL,
	"date" text DEFAULT '' NOT NULL,
	"event" text DEFAULT '' NOT NULL,
	"prep" text DEFAULT '' NOT NULL,
	"sort" integer DEFAULT 0 NOT NULL,
	"version" integer DEFAULT 1 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_by" integer
);
--> statement-breakpoint
CREATE TABLE "schedule_slots" (
	"id" serial PRIMARY KEY NOT NULL,
	"schedule_id" integer NOT NULL,
	"time" text DEFAULT '' NOT NULL,
	"text" text DEFAULT '' NOT NULL,
	"who" text DEFAULT '' NOT NULL,
	"sort" integer DEFAULT 0 NOT NULL
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" serial PRIMARY KEY NOT NULL,
	"username" text NOT NULL,
	"name" text DEFAULT '' NOT NULL,
	"password_hash" text NOT NULL,
	"role" text DEFAULT 'dept' NOT NULL,
	"team" text DEFAULT '' NOT NULL,
	"homestay_id" integer,
	"active" boolean DEFAULT true NOT NULL,
	"token_version" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"last_login_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "visitors" (
	"id" serial PRIMARY KEY NOT NULL,
	"pid" text NOT NULL,
	"gno" text DEFAULT '' NOT NULL,
	"name" text DEFAULT '' NOT NULL,
	"sex" text DEFAULT '' NOT NULL,
	"tel" text DEFAULT '' NOT NULL,
	"country" text DEFAULT '' NOT NULL,
	"lang" text DEFAULT '' NOT NULL,
	"facility_id" integer,
	"homestay_id" integer,
	"orphan_stay" text DEFAULT '' NOT NULL,
	"stay" text DEFAULT '' NOT NULL,
	"role" text DEFAULT '' NOT NULL,
	"status" text DEFAULT '확정' NOT NULL,
	"note" text DEFAULT '' NOT NULL,
	"version" integer DEFAULT 1 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_by" integer
);
--> statement-breakpoint
CREATE TABLE "volunteers" (
	"id" serial PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"tel" text DEFAULT '' NOT NULL,
	"team" text DEFAULT '' NOT NULL,
	"role" text DEFAULT '' NOT NULL,
	"task" text DEFAULT '' NOT NULL,
	"langs" text DEFAULT '' NOT NULL,
	"org" text DEFAULT '' NOT NULL,
	"dept_id" integer,
	"note" text DEFAULT '' NOT NULL,
	"version" integer DEFAULT 1 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_by" integer
);
--> statement-breakpoint
CREATE TABLE "wyd_status" (
	"id" serial PRIMARY KEY NOT NULL,
	"date" date NOT NULL,
	"today" bigint,
	"total" bigint,
	"progress" text,
	"churches" bigint,
	"orgs" bigint,
	"church_total" bigint,
	"fetched_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "schedule_slots" ADD CONSTRAINT "schedule_slots_schedule_id_schedule_id_fk" FOREIGN KEY ("schedule_id") REFERENCES "public"."schedule"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "users" ADD CONSTRAINT "users_homestay_id_homestays_id_fk" FOREIGN KEY ("homestay_id") REFERENCES "public"."homestays"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "visitors" ADD CONSTRAINT "visitors_facility_id_facilities_id_fk" FOREIGN KEY ("facility_id") REFERENCES "public"."facilities"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "visitors" ADD CONSTRAINT "visitors_homestay_id_homestays_id_fk" FOREIGN KEY ("homestay_id") REFERENCES "public"."homestays"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "volunteers" ADD CONSTRAINT "volunteers_dept_id_departments_id_fk" FOREIGN KEY ("dept_id") REFERENCES "public"."departments"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "audit_log_at_idx" ON "audit_log" USING btree ("at");--> statement-breakpoint
CREATE UNIQUE INDEX "departments_name_uq" ON "departments" USING btree ("name");--> statement-breakpoint
CREATE UNIQUE INDEX "facilities_name_uq" ON "facilities" USING btree ("name");--> statement-breakpoint
CREATE INDEX "gori_date_idx" ON "gori" USING btree ("date");--> statement-breakpoint
CREATE UNIQUE INDEX "homestays_hid_uq" ON "homestays" USING btree ("hid");--> statement-breakpoint
CREATE INDEX "schedule_slots_day_idx" ON "schedule_slots" USING btree ("schedule_id");--> statement-breakpoint
CREATE UNIQUE INDEX "users_username_uq" ON "users" USING btree (lower("username"));--> statement-breakpoint
CREATE UNIQUE INDEX "visitors_pid_uq" ON "visitors" USING btree ("pid");--> statement-breakpoint
CREATE INDEX "visitors_facility_idx" ON "visitors" USING btree ("facility_id");--> statement-breakpoint
CREATE INDEX "visitors_homestay_idx" ON "visitors" USING btree ("homestay_id");--> statement-breakpoint
CREATE INDEX "volunteers_team_idx" ON "volunteers" USING btree ("team");