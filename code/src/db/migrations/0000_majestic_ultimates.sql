CREATE TABLE "accounts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"name" varchar(50) NOT NULL,
	"type" varchar(20) NOT NULL,
	"initial_balance" numeric(15, 2) DEFAULT '0' NOT NULL,
	"currency" varchar(10) DEFAULT 'CNY' NOT NULL,
	"note" varchar(200),
	"is_active" boolean DEFAULT true NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "amortizations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"transaction_id" uuid NOT NULL,
	"total_amount" numeric(15, 2) NOT NULL,
	"monthly_amount" numeric(15, 2) NOT NULL,
	"start_month" char(7) NOT NULL,
	"total_months" integer NOT NULL,
	"status" varchar(20) DEFAULT 'active' NOT NULL,
	"note" varchar(500),
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "audit_logs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"action" varchar(20) NOT NULL,
	"resource_type" varchar(50) NOT NULL,
	"resource_id" uuid NOT NULL,
	"changes" jsonb,
	"tool_name" varchar(100),
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "budgets" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"year_month" char(7) NOT NULL,
	"category_id" uuid NOT NULL,
	"amount" numeric(15, 2) NOT NULL,
	"alert_threshold" integer DEFAULT 80 NOT NULL,
	"recurring" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "categories" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"name" varchar(30) NOT NULL,
	"type" varchar(10) NOT NULL,
	"parent_id" uuid,
	"group_label" varchar(50),
	"icon" varchar(10),
	"color" varchar(7),
	"is_preset" boolean DEFAULT false NOT NULL,
	"is_hidden" boolean DEFAULT false NOT NULL,
	"count_in_stats" boolean DEFAULT true NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "investment_accounts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"name" varchar(100) NOT NULL,
	"type" varchar(20) NOT NULL,
	"currency" varchar(10) DEFAULT 'CNY' NOT NULL,
	"note" varchar(500),
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "investment_transactions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"account_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"type" varchar(10) NOT NULL,
	"asset_name" varchar(100) NOT NULL,
	"asset_code" varchar(20),
	"quantity" numeric(20, 6),
	"price" numeric(15, 6),
	"amount" numeric(15, 2) NOT NULL,
	"date" date DEFAULT now() NOT NULL,
	"note" varchar(500),
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "investment_valuations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"account_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"current_value" numeric(15, 2) NOT NULL,
	"valuation_date" date DEFAULT now() NOT NULL,
	"note" varchar(200),
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "net_worth_snapshots" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"snapshot_date" date DEFAULT now() NOT NULL,
	"total_assets" numeric(15, 2) NOT NULL,
	"total_liabilities" numeric(15, 2) DEFAULT '0' NOT NULL,
	"net_worth" numeric(15, 2) NOT NULL,
	"account_details" jsonb,
	"note" varchar(200),
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "subscriptions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"name" varchar(100) NOT NULL,
	"amount" numeric(15, 2) NOT NULL,
	"cycle" varchar(20) NOT NULL,
	"account_id" uuid NOT NULL,
	"category_id" uuid,
	"next_billing_date" date NOT NULL,
	"auto_renew" boolean DEFAULT true NOT NULL,
	"status" varchar(20) DEFAULT 'active' NOT NULL,
	"note" varchar(500),
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "tag_definitions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"dimension" varchar(30) NOT NULL,
	"dimension_label" varchar(30) NOT NULL,
	"value" varchar(30) NOT NULL,
	"description" varchar(200) NOT NULL,
	"is_preset" boolean DEFAULT true NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "transactions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"type" varchar(10) NOT NULL,
	"amount" numeric(15, 2) NOT NULL,
	"category_id" uuid,
	"account_id" uuid NOT NULL,
	"to_account_id" uuid,
	"occurred_at" timestamp with time zone DEFAULT now() NOT NULL,
	"note" varchar(500),
	"tag_labels" jsonb,
	"source_text" text,
	"is_system" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone,
	"deleted_reason" varchar(200)
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"username" varchar(50) NOT NULL,
	"email" varchar(255),
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone,
	CONSTRAINT "users_username_unique" UNIQUE("username"),
	CONSTRAINT "users_email_unique" UNIQUE("email")
);
--> statement-breakpoint
ALTER TABLE "accounts" ADD CONSTRAINT "accounts_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "amortizations" ADD CONSTRAINT "amortizations_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "amortizations" ADD CONSTRAINT "amortizations_transaction_id_transactions_id_fk" FOREIGN KEY ("transaction_id") REFERENCES "public"."transactions"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "audit_logs" ADD CONSTRAINT "audit_logs_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "budgets" ADD CONSTRAINT "budgets_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "budgets" ADD CONSTRAINT "budgets_category_id_categories_id_fk" FOREIGN KEY ("category_id") REFERENCES "public"."categories"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "categories" ADD CONSTRAINT "categories_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "categories" ADD CONSTRAINT "categories_parent_id_categories_id_fk" FOREIGN KEY ("parent_id") REFERENCES "public"."categories"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "investment_accounts" ADD CONSTRAINT "investment_accounts_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "investment_transactions" ADD CONSTRAINT "investment_transactions_account_id_investment_accounts_id_fk" FOREIGN KEY ("account_id") REFERENCES "public"."investment_accounts"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "investment_transactions" ADD CONSTRAINT "investment_transactions_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "investment_valuations" ADD CONSTRAINT "investment_valuations_account_id_investment_accounts_id_fk" FOREIGN KEY ("account_id") REFERENCES "public"."investment_accounts"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "investment_valuations" ADD CONSTRAINT "investment_valuations_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "net_worth_snapshots" ADD CONSTRAINT "net_worth_snapshots_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "subscriptions" ADD CONSTRAINT "subscriptions_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "subscriptions" ADD CONSTRAINT "subscriptions_account_id_accounts_id_fk" FOREIGN KEY ("account_id") REFERENCES "public"."accounts"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "subscriptions" ADD CONSTRAINT "subscriptions_category_id_categories_id_fk" FOREIGN KEY ("category_id") REFERENCES "public"."categories"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "transactions" ADD CONSTRAINT "transactions_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "transactions" ADD CONSTRAINT "transactions_category_id_categories_id_fk" FOREIGN KEY ("category_id") REFERENCES "public"."categories"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "transactions" ADD CONSTRAINT "transactions_account_id_accounts_id_fk" FOREIGN KEY ("account_id") REFERENCES "public"."accounts"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "transactions" ADD CONSTRAINT "transactions_to_account_id_accounts_id_fk" FOREIGN KEY ("to_account_id") REFERENCES "public"."accounts"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "idx_accounts_user_id" ON "accounts" USING btree ("user_id") WHERE "accounts"."deleted_at" IS NULL;--> statement-breakpoint
CREATE INDEX "idx_amortizations_user" ON "amortizations" USING btree ("user_id","status");--> statement-breakpoint
CREATE INDEX "idx_amortizations_transaction" ON "amortizations" USING btree ("transaction_id");--> statement-breakpoint
CREATE INDEX "idx_audit_logs_user" ON "audit_logs" USING btree ("user_id","created_at");--> statement-breakpoint
CREATE INDEX "idx_audit_logs_resource" ON "audit_logs" USING btree ("resource_type","resource_id");--> statement-breakpoint
CREATE UNIQUE INDEX "uq_budgets_user_month_category" ON "budgets" USING btree ("user_id","year_month","category_id");--> statement-breakpoint
CREATE INDEX "idx_budgets_user_month" ON "budgets" USING btree ("user_id","year_month");--> statement-breakpoint
CREATE INDEX "idx_categories_user_type" ON "categories" USING btree ("user_id","type") WHERE "categories"."deleted_at" IS NULL;--> statement-breakpoint
CREATE INDEX "idx_categories_parent" ON "categories" USING btree ("parent_id") WHERE "categories"."deleted_at" IS NULL;--> statement-breakpoint
CREATE INDEX "idx_inv_transactions_account" ON "investment_transactions" USING btree ("account_id") WHERE "investment_transactions"."deleted_at" IS NULL;--> statement-breakpoint
CREATE UNIQUE INDEX "uq_inv_valuations_account_date" ON "investment_valuations" USING btree ("account_id","valuation_date");--> statement-breakpoint
CREATE UNIQUE INDEX "uq_net_worth_user_date" ON "net_worth_snapshots" USING btree ("user_id","snapshot_date");--> statement-breakpoint
CREATE INDEX "idx_net_worth_user_date" ON "net_worth_snapshots" USING btree ("user_id","snapshot_date");--> statement-breakpoint
CREATE INDEX "idx_subscriptions_user" ON "subscriptions" USING btree ("user_id","status") WHERE "subscriptions"."deleted_at" IS NULL;--> statement-breakpoint
CREATE INDEX "idx_subscriptions_billing" ON "subscriptions" USING btree ("next_billing_date") WHERE "subscriptions"."deleted_at" IS NULL AND "subscriptions"."status" = 'active';--> statement-breakpoint
CREATE UNIQUE INDEX "uq_tag_definitions_dim_value" ON "tag_definitions" USING btree ("dimension","value");--> statement-breakpoint
CREATE INDEX "idx_tag_definitions_dimension" ON "tag_definitions" USING btree ("dimension");--> statement-breakpoint
CREATE INDEX "idx_transactions_user_date" ON "transactions" USING btree ("user_id","occurred_at") WHERE "transactions"."deleted_at" IS NULL;--> statement-breakpoint
CREATE INDEX "idx_transactions_account" ON "transactions" USING btree ("account_id") WHERE "transactions"."deleted_at" IS NULL;--> statement-breakpoint
CREATE INDEX "idx_transactions_category" ON "transactions" USING btree ("category_id") WHERE "transactions"."deleted_at" IS NULL;--> statement-breakpoint
CREATE INDEX "idx_transactions_type" ON "transactions" USING btree ("user_id","type") WHERE "transactions"."deleted_at" IS NULL;