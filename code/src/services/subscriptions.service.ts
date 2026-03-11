import { db } from '../db/client.js';
import { subscriptions, accounts, categories } from '../db/schema.js';
import { eq, and, isNull, lte, sql } from 'drizzle-orm';
import { FinanceError } from '../utils/errors.js';
import { writeAuditLog } from '../utils/audit.js';
import { formatAmount } from '../utils/response.js';

const CYCLE_MONTHS: Record<string, number> = {
  weekly: 1 / 4.33,
  monthly: 1,
  quarterly: 3,
  yearly: 12,
};

function calcAnnualCost(amount: number, cycle: string): number {
  const months = CYCLE_MONTHS[cycle] ?? 1;
  return parseFloat(((amount / months) * 12).toFixed(2));
}

export async function createSubscription(params: {
  userId: string;
  name: string;
  amount: number;
  cycle: string;
  accountId: string;
  categoryId?: string;
  nextBillingDate: string;
  autoRenew?: boolean;
  note?: string;
}): Promise<string> {
  const [sub] = await db
    .insert(subscriptions)
    .values({
      userId: params.userId,
      name: params.name,
      amount: String(params.amount),
      cycle: params.cycle,
      accountId: params.accountId,
      categoryId: params.categoryId ?? null,
      nextBillingDate: params.nextBillingDate,
      autoRenew: params.autoRenew ?? true,
      note: params.note ?? null,
    })
    .returning({ id: subscriptions.id });

  await writeAuditLog({
    userId: params.userId,
    action: 'create',
    resourceType: 'subscription',
    resourceId: sub.id,
    changes: { after: params },
    toolName: 'record_subscription',
  });

  return sub.id;
}

export async function updateSubscription(
  subscriptionId: string,
  userId: string,
  params: {
    name?: string;
    amount?: number;
    cycle?: string;
    accountId?: string;
    categoryId?: string;
    nextBillingDate?: string;
    autoRenew?: boolean;
    status?: string;
    note?: string;
  }
): Promise<void> {
  const [existing] = await db
    .select()
    .from(subscriptions)
    .where(and(eq(subscriptions.id, subscriptionId), eq(subscriptions.userId, userId), isNull(subscriptions.deletedAt)))
    .limit(1);

  if (!existing) {
    throw new FinanceError('NOT_FOUND', `订阅 ${subscriptionId} 不存在`);
  }

  const updateData: Record<string, unknown> = { updatedAt: new Date() };
  if (params.name !== undefined) updateData.name = params.name;
  if (params.amount !== undefined) updateData.amount = String(params.amount);
  if (params.cycle !== undefined) updateData.cycle = params.cycle;
  if (params.accountId !== undefined) updateData.accountId = params.accountId;
  if (params.categoryId !== undefined) updateData.categoryId = params.categoryId;
  if (params.nextBillingDate !== undefined) updateData.nextBillingDate = params.nextBillingDate;
  if (params.autoRenew !== undefined) updateData.autoRenew = params.autoRenew;
  if (params.status !== undefined) updateData.status = params.status;
  if (params.note !== undefined) updateData.note = params.note;

  await db.update(subscriptions).set(updateData as Partial<typeof subscriptions.$inferInsert>).where(eq(subscriptions.id, subscriptionId));

  await writeAuditLog({
    userId,
    action: 'update',
    resourceType: 'subscription',
    resourceId: subscriptionId,
    changes: { before: existing, after: params },
    toolName: 'update_subscription',
  });
}

export async function listSubscriptions(params: {
  userId: string;
  status?: string;
  upcomingDays?: number;
}) {
  const { userId, status = 'active', upcomingDays = 7 } = params;

  const conditions = [eq(subscriptions.userId, userId), isNull(subscriptions.deletedAt)];
  if (status !== 'all') conditions.push(eq(subscriptions.status, status));

  const subList = await db
    .select({
      id: subscriptions.id,
      name: subscriptions.name,
      amount: subscriptions.amount,
      cycle: subscriptions.cycle,
      accountId: subscriptions.accountId,
      accountName: accounts.name,
      categoryId: subscriptions.categoryId,
      nextBillingDate: subscriptions.nextBillingDate,
      autoRenew: subscriptions.autoRenew,
      status: subscriptions.status,
      note: subscriptions.note,
    })
    .from(subscriptions)
    .innerJoin(accounts, eq(accounts.id, subscriptions.accountId))
    .where(and(...conditions))
    .orderBy(subscriptions.nextBillingDate);

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const result = subList.map((sub) => {
    const billingDate = new Date(sub.nextBillingDate);
    const daysUntil = Math.ceil((billingDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
    const amount = formatAmount(sub.amount);

    return {
      subscription_id: sub.id,
      name: sub.name,
      amount,
      cycle: sub.cycle,
      account_name: sub.accountName,
      next_billing_date: sub.nextBillingDate,
      days_until_billing: daysUntil,
      is_upcoming: daysUntil >= 0 && daysUntil <= upcomingDays,
      status: sub.status,
      annual_cost: calcAnnualCost(amount, sub.cycle),
      auto_renew: sub.autoRenew,
    };
  });

  // 月费总计（所有活跃订阅）
  const activeMonthly = subList
    .filter((s) => s.status === 'active')
    .reduce((sum, sub) => {
      const amount = formatAmount(sub.amount);
      const months = CYCLE_MONTHS[sub.cycle] ?? 1;
      return sum + amount / months;
    }, 0);

  // 近期扣费
  const upcoming = result.filter((s) => s.is_upcoming && s.status === 'active').map((s) => ({
    name: s.name,
    amount: s.amount,
    billing_date: s.next_billing_date,
  }));

  return {
    subscriptions: result,
    monthly_total: parseFloat(activeMonthly.toFixed(2)),
    upcoming_charges: upcoming,
  };
}
