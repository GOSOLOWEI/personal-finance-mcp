import { db } from '../db/client.js';
import { auditLogs, transactions, accounts, categories, subscriptions, amortizations } from '../db/schema.js';
import { eq, and, isNull, sql, desc } from 'drizzle-orm';
import { FinanceError } from '../utils/errors.js';
import { writeAuditLog } from '../utils/audit.js';

export async function listAuditLogs(params: {
  userId: string;
  resourceId?: string;
  resourceType?: string;
  startDate?: string;
  endDate?: string;
  action?: string;
  page?: number;
  pageSize?: number;
}) {
  const {
    userId,
    resourceId,
    resourceType,
    startDate,
    endDate,
    action,
    page = 1,
    pageSize = 20,
  } = params;

  const conditions = [eq(auditLogs.userId, userId)];

  if (resourceId) conditions.push(eq(auditLogs.resourceId, resourceId));
  if (resourceType) conditions.push(eq(auditLogs.resourceType, resourceType));
  if (action) conditions.push(eq(auditLogs.action, action));
  if (startDate) conditions.push(sql`${auditLogs.createdAt} >= ${startDate}::date`);
  if (endDate) conditions.push(sql`${auditLogs.createdAt} < (${endDate}::date + INTERVAL '1 day')`);

  const offset = (page - 1) * pageSize;

  const [totalResult, items] = await Promise.all([
    db
      .select({ count: sql<number>`count(*)::int` })
      .from(auditLogs)
      .where(and(...conditions)),
    db
      .select()
      .from(auditLogs)
      .where(and(...conditions))
      .orderBy(desc(auditLogs.createdAt))
      .limit(pageSize)
      .offset(offset),
  ]);

  return {
    items,
    pagination: {
      page,
      page_size: pageSize,
      total: totalResult[0]?.count ?? 0,
      total_pages: Math.ceil((totalResult[0]?.count ?? 0) / pageSize),
    },
  };
}

type ResourceTable = 'transaction' | 'account' | 'category' | 'subscription' | 'amortization';

const resourceTableMap: Record<ResourceTable, typeof transactions | typeof accounts | typeof categories | typeof subscriptions | typeof amortizations> = {
  transaction: transactions,
  account: accounts,
  category: categories,
  subscription: subscriptions,
  amortization: amortizations,
};

export async function restoreDeletedRecord(params: {
  userId: string;
  resourceType: string;
  resourceId: string;
}): Promise<void> {
  const { userId, resourceType, resourceId } = params;

  const table = resourceTableMap[resourceType as ResourceTable];
  if (!table) {
    throw new FinanceError('VALIDATION_ERROR', `不支持恢复的资源类型: ${resourceType}`);
  }

  const [existing] = await db
    .select()
    .from(table as typeof transactions)
    .where(and(eq((table as typeof transactions).id, resourceId)))
    .limit(1) as Array<{ deletedAt: Date | null }>;

  if (!existing) {
    throw new FinanceError('NOT_FOUND', `${resourceType} ${resourceId} 不存在`);
  }

  if (!existing.deletedAt) {
    throw new FinanceError('CONFLICT', `${resourceType} ${resourceId} 未被删除，无需恢复`);
  }

  await db
    .update(table as typeof transactions)
    .set({ deletedAt: null })
    .where(eq((table as typeof transactions).id, resourceId));

  await writeAuditLog({
    userId,
    action: 'restore',
    resourceType,
    resourceId,
    toolName: 'restore_deleted_record',
  });
}
