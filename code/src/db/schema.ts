import {
  pgTable,
  uuid,
  varchar,
  text,
  boolean,
  integer,
  numeric,
  timestamp,
  date,
  char,
  jsonb,
  index,
  uniqueIndex,
  check,
} from 'drizzle-orm/pg-core';
import { sql } from 'drizzle-orm';

// ─────────────────────────────────────────────────────────────────────────────
// users — 用户表（预留多用户扩展）
// ─────────────────────────────────────────────────────────────────────────────
export const users = pgTable('users', {
  id: uuid('id').primaryKey().defaultRandom(),
  username: varchar('username', { length: 50 }).notNull().unique(),
  email: varchar('email', { length: 255 }).unique(),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  deletedAt: timestamp('deleted_at', { withTimezone: true }),
});

// ─────────────────────────────────────────────────────────────────────────────
// accounts — 账户表
// ─────────────────────────────────────────────────────────────────────────────
export const accounts = pgTable(
  'accounts',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id),
    name: varchar('name', { length: 50 }).notNull(),
    type: varchar('type', { length: 20 }).notNull(),
    // checking | savings | alipay | wechat | credit_card | investment | cash | other
    initialBalance: numeric('initial_balance', { precision: 15, scale: 2 }).notNull().default('0'),
    currency: varchar('currency', { length: 10 }).notNull().default('CNY'),
    note: varchar('note', { length: 200 }),
    isActive: boolean('is_active').notNull().default(true),
    sortOrder: integer('sort_order').notNull().default(0),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
    deletedAt: timestamp('deleted_at', { withTimezone: true }),
  },
  (table) => [
    index('idx_accounts_user_id').on(table.userId).where(sql`${table.deletedAt} IS NULL`),
  ]
);

// ─────────────────────────────────────────────────────────────────────────────
// categories — 分类表（两级树形结构）
// ─────────────────────────────────────────────────────────────────────────────
export const categories = pgTable(
  'categories',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id),
    name: varchar('name', { length: 30 }).notNull(),
    type: varchar('type', { length: 10 }).notNull(), // income | expense
    parentId: uuid('parent_id').references((): any => categories.id),
    groupLabel: varchar('group_label', { length: 50 }),
    icon: varchar('icon', { length: 10 }),
    color: varchar('color', { length: 7 }),
    isPreset: boolean('is_preset').notNull().default(false),
    isHidden: boolean('is_hidden').notNull().default(false),
    countInStats: boolean('count_in_stats').notNull().default(true),
    sortOrder: integer('sort_order').notNull().default(0),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
    deletedAt: timestamp('deleted_at', { withTimezone: true }),
  },
  (table) => [
    index('idx_categories_user_type')
      .on(table.userId, table.type)
      .where(sql`${table.deletedAt} IS NULL`),
    index('idx_categories_parent')
      .on(table.parentId)
      .where(sql`${table.deletedAt} IS NULL`),
  ]
);

// ─────────────────────────────────────────────────────────────────────────────
// transactions — 交易记录表（核心表）
// ─────────────────────────────────────────────────────────────────────────────
export const transactions = pgTable(
  'transactions',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id),
    type: varchar('type', { length: 10 }).notNull(), // income | expense | transfer
    amount: numeric('amount', { precision: 15, scale: 2 }).notNull(),
    categoryId: uuid('category_id').references(() => categories.id),
    accountId: uuid('account_id')
      .notNull()
      .references(() => accounts.id),
    toAccountId: uuid('to_account_id').references(() => accounts.id),
    occurredAt: timestamp('occurred_at', { withTimezone: true }).notNull().defaultNow(),
    note: varchar('note', { length: 500 }),
    tagLabels: jsonb('tag_labels'),
    // {"method":"线上","behavior":"日常消费","consumption_type":"必选消费","scale":"小额支出","purpose":"生存必需"}
    sourceText: text('source_text'),
    isSystem: boolean('is_system').notNull().default(false),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
    deletedAt: timestamp('deleted_at', { withTimezone: true }),
    deletedReason: varchar('deleted_reason', { length: 200 }),
  },
  (table) => [
    index('idx_transactions_user_date')
      .on(table.userId, table.occurredAt)
      .where(sql`${table.deletedAt} IS NULL`),
    index('idx_transactions_account')
      .on(table.accountId)
      .where(sql`${table.deletedAt} IS NULL`),
    index('idx_transactions_category')
      .on(table.categoryId)
      .where(sql`${table.deletedAt} IS NULL`),
    index('idx_transactions_type')
      .on(table.userId, table.type)
      .where(sql`${table.deletedAt} IS NULL`),
  ]
);

// ─────────────────────────────────────────────────────────────────────────────
// budgets — 预算表
// ─────────────────────────────────────────────────────────────────────────────
export const budgets = pgTable(
  'budgets',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id),
    yearMonth: char('year_month', { length: 7 }).notNull(), // "2026-03"
    categoryId: uuid('category_id')
      .notNull()
      .references(() => categories.id),
    amount: numeric('amount', { precision: 15, scale: 2 }).notNull(),
    alertThreshold: integer('alert_threshold').notNull().default(80),
    recurring: boolean('recurring').notNull().default(true),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    uniqueIndex('uq_budgets_user_month_category').on(
      table.userId,
      table.yearMonth,
      table.categoryId
    ),
    index('idx_budgets_user_month').on(table.userId, table.yearMonth),
  ]
);

// ─────────────────────────────────────────────────────────────────────────────
// tag_definitions — 标签体系定义表
// ─────────────────────────────────────────────────────────────────────────────
export const tagDefinitions = pgTable(
  'tag_definitions',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    dimension: varchar('dimension', { length: 30 }).notNull(),
    // method | behavior | consumption_type | scale | purpose
    dimensionLabel: varchar('dimension_label', { length: 30 }).notNull(),
    value: varchar('value', { length: 30 }).notNull(),
    description: varchar('description', { length: 200 }).notNull(),
    isPreset: boolean('is_preset').notNull().default(true),
    sortOrder: integer('sort_order').notNull().default(0),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    uniqueIndex('uq_tag_definitions_dim_value').on(table.dimension, table.value),
    index('idx_tag_definitions_dimension').on(table.dimension),
  ]
);

// ─────────────────────────────────────────────────────────────────────────────
// subscriptions — 订阅管理表
// ─────────────────────────────────────────────────────────────────────────────
export const subscriptions = pgTable(
  'subscriptions',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id),
    name: varchar('name', { length: 100 }).notNull(),
    amount: numeric('amount', { precision: 15, scale: 2 }).notNull(),
    cycle: varchar('cycle', { length: 20 }).notNull(), // monthly | quarterly | yearly | weekly
    accountId: uuid('account_id')
      .notNull()
      .references(() => accounts.id),
    categoryId: uuid('category_id').references(() => categories.id),
    nextBillingDate: date('next_billing_date').notNull(),
    autoRenew: boolean('auto_renew').notNull().default(true),
    status: varchar('status', { length: 20 }).notNull().default('active'),
    // active | cancelled | paused
    note: varchar('note', { length: 500 }),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
    deletedAt: timestamp('deleted_at', { withTimezone: true }),
  },
  (table) => [
    index('idx_subscriptions_user').on(table.userId, table.status).where(sql`${table.deletedAt} IS NULL`),
    index('idx_subscriptions_billing')
      .on(table.nextBillingDate)
      .where(sql`${table.deletedAt} IS NULL AND ${table.status} = 'active'`),
  ]
);

// ─────────────────────────────────────────────────────────────────────────────
// amortizations — 财务分摊计划表
// ─────────────────────────────────────────────────────────────────────────────
export const amortizations = pgTable(
  'amortizations',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id),
    transactionId: uuid('transaction_id')
      .notNull()
      .references(() => transactions.id),
    totalAmount: numeric('total_amount', { precision: 15, scale: 2 }).notNull(),
    monthlyAmount: numeric('monthly_amount', { precision: 15, scale: 2 }).notNull(),
    startMonth: char('start_month', { length: 7 }).notNull(), // "2026-03"
    totalMonths: integer('total_months').notNull(),
    status: varchar('status', { length: 20 }).notNull().default('active'),
    // active | cancelled | completed
    note: varchar('note', { length: 500 }),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index('idx_amortizations_user').on(table.userId, table.status),
    index('idx_amortizations_transaction').on(table.transactionId),
  ]
);

// ─────────────────────────────────────────────────────────────────────────────
// investment_accounts — 投资账户表
// ─────────────────────────────────────────────────────────────────────────────
export const investmentAccounts = pgTable('investment_accounts', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: uuid('user_id')
    .notNull()
    .references(() => users.id),
  name: varchar('name', { length: 100 }).notNull(),
  type: varchar('type', { length: 20 }).notNull(), // stock | fund | crypto | bond | other
  currency: varchar('currency', { length: 10 }).notNull().default('CNY'),
  note: varchar('note', { length: 500 }),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  deletedAt: timestamp('deleted_at', { withTimezone: true }),
});

// ─────────────────────────────────────────────────────────────────────────────
// investment_transactions — 投资交易记录表
// ─────────────────────────────────────────────────────────────────────────────
export const investmentTransactions = pgTable(
  'investment_transactions',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    accountId: uuid('account_id')
      .notNull()
      .references(() => investmentAccounts.id),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id),
    type: varchar('type', { length: 10 }).notNull(), // buy | sell | dividend | fee
    assetName: varchar('asset_name', { length: 100 }).notNull(),
    assetCode: varchar('asset_code', { length: 20 }),
    quantity: numeric('quantity', { precision: 20, scale: 6 }),
    price: numeric('price', { precision: 15, scale: 6 }),
    amount: numeric('amount', { precision: 15, scale: 2 }).notNull(),
    date: date('date').notNull().defaultNow(),
    note: varchar('note', { length: 500 }),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
    deletedAt: timestamp('deleted_at', { withTimezone: true }),
  },
  (table) => [
    index('idx_inv_transactions_account')
      .on(table.accountId)
      .where(sql`${table.deletedAt} IS NULL`),
  ]
);

// ─────────────────────────────────────────────────────────────────────────────
// investment_valuations — 投资估值快照表
// ─────────────────────────────────────────────────────────────────────────────
export const investmentValuations = pgTable(
  'investment_valuations',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    accountId: uuid('account_id')
      .notNull()
      .references(() => investmentAccounts.id),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id),
    currentValue: numeric('current_value', { precision: 15, scale: 2 }).notNull(),
    valuationDate: date('valuation_date').notNull().defaultNow(),
    note: varchar('note', { length: 200 }),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    uniqueIndex('uq_inv_valuations_account_date').on(table.accountId, table.valuationDate),
  ]
);

// ─────────────────────────────────────────────────────────────────────────────
// net_worth_snapshots — 净资产快照表
// ─────────────────────────────────────────────────────────────────────────────
export const netWorthSnapshots = pgTable(
  'net_worth_snapshots',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id),
    snapshotDate: date('snapshot_date').notNull().defaultNow(),
    totalAssets: numeric('total_assets', { precision: 15, scale: 2 }).notNull(),
    totalLiabilities: numeric('total_liabilities', { precision: 15, scale: 2 })
      .notNull()
      .default('0'),
    netWorth: numeric('net_worth', { precision: 15, scale: 2 }).notNull(),
    accountDetails: jsonb('account_details'), // [{id, name, balance}]
    note: varchar('note', { length: 200 }),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    uniqueIndex('uq_net_worth_user_date').on(table.userId, table.snapshotDate),
    index('idx_net_worth_user_date').on(table.userId, table.snapshotDate),
  ]
);

// ─────────────────────────────────────────────────────────────────────────────
// audit_logs — 审计日志表
// ─────────────────────────────────────────────────────────────────────────────
export const auditLogs = pgTable(
  'audit_logs',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id),
    action: varchar('action', { length: 20 }).notNull(), // create | update | delete | restore
    resourceType: varchar('resource_type', { length: 50 }).notNull(),
    // transaction | account | category | budget | subscription | amortization
    resourceId: uuid('resource_id').notNull(),
    changes: jsonb('changes'), // {before: {...}, after: {...}}
    toolName: varchar('tool_name', { length: 100 }),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index('idx_audit_logs_user').on(table.userId, table.createdAt),
    index('idx_audit_logs_resource').on(table.resourceType, table.resourceId),
  ]
);

// ─────────────────────────────────────────────────────────────────────────────
// 类型导出
// ─────────────────────────────────────────────────────────────────────────────
export type User = typeof users.$inferSelect;
export type NewUser = typeof users.$inferInsert;
export type Account = typeof accounts.$inferSelect;
export type NewAccount = typeof accounts.$inferInsert;
export type Category = typeof categories.$inferSelect;
export type NewCategory = typeof categories.$inferInsert;
export type Transaction = typeof transactions.$inferSelect;
export type NewTransaction = typeof transactions.$inferInsert;
export type Budget = typeof budgets.$inferSelect;
export type NewBudget = typeof budgets.$inferInsert;
export type TagDefinition = typeof tagDefinitions.$inferSelect;
export type Subscription = typeof subscriptions.$inferSelect;
export type NewSubscription = typeof subscriptions.$inferInsert;
export type Amortization = typeof amortizations.$inferSelect;
export type NewAmortization = typeof amortizations.$inferInsert;
export type InvestmentAccount = typeof investmentAccounts.$inferSelect;
export type InvestmentTransaction = typeof investmentTransactions.$inferSelect;
export type InvestmentValuation = typeof investmentValuations.$inferSelect;
export type NetWorthSnapshot = typeof netWorthSnapshots.$inferSelect;
export type AuditLog = typeof auditLogs.$inferSelect;
