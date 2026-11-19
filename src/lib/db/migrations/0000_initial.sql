CREATE TABLE "accounts" (
	"user_id" uuid NOT NULL,
	"type" text NOT NULL,
	"provider" text NOT NULL,
	"provider_account_id" text NOT NULL,
	"refresh_token" text,
	"access_token" text,
	"expires_at" integer,
	"token_type" text,
	"scope" text,
	"id_token" text,
	"session_state" text,
	CONSTRAINT "accounts_provider_provider_account_id_pk" PRIMARY KEY("provider","provider_account_id")
);
--> statement-breakpoint
CREATE TABLE "items" (
	"id" text PRIMARY KEY NOT NULL,
	"instrument" text NOT NULL,
	"text" text NOT NULL,
	"domain" text,
	"facet" text,
	"reverse_keyed" boolean,
	"response_min" double precision,
	"response_max" double precision,
	"source" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE "assessment_results" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"payload" jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "matches" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"occupation_code" text NOT NULL,
	"score" double precision,
	"components" jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "occ_demand" (
	"occupation_code" text NOT NULL,
	"metric" text NOT NULL,
	"value" double precision NOT NULL,
	"unit" text DEFAULT '' NOT NULL,
	"year" integer DEFAULT 0 NOT NULL,
	"source" text NOT NULL,
	CONSTRAINT "occ_demand_occupation_code_metric_unit_year_source_pk" PRIMARY KEY("occupation_code","metric","unit","year","source")
);
--> statement-breakpoint
CREATE TABLE "occ_interests" (
	"occupation_code" text NOT NULL,
	"element_id" text NOT NULL,
	"element_name" text NOT NULL,
	"scale_id" text NOT NULL,
	"raw_value" double precision NOT NULL,
	"value" double precision,
	"source" text NOT NULL,
	CONSTRAINT "occ_interests_occupation_code_element_id_scale_id_pk" PRIMARY KEY("occupation_code","element_id","scale_id")
);
--> statement-breakpoint
CREATE TABLE "occ_requirements" (
	"occupation_code" text NOT NULL,
	"element_id" text NOT NULL,
	"element_name" text NOT NULL,
	"scale_id" text NOT NULL,
	"raw_value" double precision NOT NULL,
	"value" double precision,
	"source" text NOT NULL,
	CONSTRAINT "occ_requirements_occupation_code_element_id_scale_id_pk" PRIMARY KEY("occupation_code","element_id","scale_id")
);
--> statement-breakpoint
CREATE TABLE "occ_work_styles" (
	"occupation_code" text NOT NULL,
	"element_id" text NOT NULL,
	"element_name" text NOT NULL,
	"scale_id" text NOT NULL,
	"raw_value" double precision NOT NULL,
	"value" double precision,
	"source" text NOT NULL,
	CONSTRAINT "occ_work_styles_occupation_code_element_id_scale_id_pk" PRIMARY KEY("occupation_code","element_id","scale_id")
);
--> statement-breakpoint
CREATE TABLE "occupation_ratings" (
	"occupation_code" text NOT NULL,
	"element_id" text NOT NULL,
	"element_name" text NOT NULL,
	"scale_id" text NOT NULL,
	"value" double precision NOT NULL,
	"source" text NOT NULL,
	CONSTRAINT "occupation_ratings_occupation_code_element_id_scale_id_pk" PRIMARY KEY("occupation_code","element_id","scale_id")
);
--> statement-breakpoint
CREATE TABLE "occupations" (
	"code" text PRIMARY KEY NOT NULL,
	"title" text NOT NULL,
	"description" text,
	"job_zone" integer
);
--> statement-breakpoint
CREATE TABLE "profiles" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"data" jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "responses" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"item_id" text NOT NULL,
	"value" jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "sessions" (
	"session_token" text PRIMARY KEY NOT NULL,
	"user_id" uuid NOT NULL,
	"expires" timestamp with time zone NOT NULL
);
--> statement-breakpoint
CREATE TABLE "skill_plan" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"data" jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text,
	"email" text,
	"email_verified" timestamp with time zone,
	"image" text,
	CONSTRAINT "users_email_unique" UNIQUE("email")
);
--> statement-breakpoint
CREATE TABLE "verification_tokens" (
	"identifier" text NOT NULL,
	"token" text NOT NULL,
	"expires" timestamp with time zone NOT NULL,
	CONSTRAINT "verification_tokens_identifier_token_pk" PRIMARY KEY("identifier","token")
);
--> statement-breakpoint
ALTER TABLE "accounts" ADD CONSTRAINT "accounts_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "assessment_results" ADD CONSTRAINT "assessment_results_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "matches" ADD CONSTRAINT "matches_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "matches" ADD CONSTRAINT "matches_occupation_code_occupations_code_fk" FOREIGN KEY ("occupation_code") REFERENCES "public"."occupations"("code") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "occ_demand" ADD CONSTRAINT "occ_demand_occupation_code_occupations_code_fk" FOREIGN KEY ("occupation_code") REFERENCES "public"."occupations"("code") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "occ_interests" ADD CONSTRAINT "occ_interests_occupation_code_occupations_code_fk" FOREIGN KEY ("occupation_code") REFERENCES "public"."occupations"("code") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "occ_requirements" ADD CONSTRAINT "occ_requirements_occupation_code_occupations_code_fk" FOREIGN KEY ("occupation_code") REFERENCES "public"."occupations"("code") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "occ_work_styles" ADD CONSTRAINT "occ_work_styles_occupation_code_occupations_code_fk" FOREIGN KEY ("occupation_code") REFERENCES "public"."occupations"("code") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "occupation_ratings" ADD CONSTRAINT "occupation_ratings_occupation_code_occupations_code_fk" FOREIGN KEY ("occupation_code") REFERENCES "public"."occupations"("code") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "profiles" ADD CONSTRAINT "profiles_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "responses" ADD CONSTRAINT "responses_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "responses" ADD CONSTRAINT "responses_item_id_items_id_fk" FOREIGN KEY ("item_id") REFERENCES "public"."items"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sessions" ADD CONSTRAINT "sessions_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "skill_plan" ADD CONSTRAINT "skill_plan_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;