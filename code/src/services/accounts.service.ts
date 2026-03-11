import { db } from '../db/client.js';
import { accounts, transactions } from '../db/schema.js';
import { eq, and, isNull, sql } from 'drizzle-orm';
import { FinanceError } from '../utils/errors.js';
import { writeAuditLog } from '../utils/audit.js';
import { formatAmount } from '../utils/response.js';

export interface CreateAccountParams {
  userId: string;
  name: string;
  type: string;
  initialBalance?: number;
  currency?: string;
  note?: string;
}

export interface UpdateAccountParams {
  name?: string;
  note?: string;
}

export interface AccountWithBalance {
  account_id: string;
  name: string;
  type: string;
  balance: number;
  currency: string;
  note: string | null;
  created_at: string;
}

export interface AccountListResult {
  accounts: AccountWithBalance[];
  summary: {
    total_assets: number;
    total_liabilities: number;
    net_worth: number;
  };
}

export async function createAccount(params: CreateAccountParams): Promise<string> {
  const [account] = await db
    .insert(accounts)
    .values({
      userId: params.userId,
      name: params.name,
      type: params.type,
      initialBalance: String(params.initialBalance ?? 0),
      currency: params.currency ?? 'CNY',
      note: params.note ?? null,
    })
    .returning({ id: accounts.id });

  await writeAuditLog({
    userId: params.userId,
    action: 'create',
    resourceType: 'account',
    resourceId: account.id,
    changes: { after: params },
    toolName: 'record_account',
  });

  return account.id;
}

export async function updateAccount(
  accountId: string,
  userId: string,
  params: UpdateAccountParams
): Promise<void> {
  const [existing] = await db
    .select()
    .from(accounts)
    .where(and(eq(accounts.id, accountId), eq(accounts.userId, userId), isNull(accounts.deletedAt)))
    .limit(1);

  if (!existing) {
    throw new FinanceError('NOT_FOUND', `账户 ${accountId} 不存在`);
  }

  await db
    .update(accounts)
    .set({
      ...(params.name !== undefined && { name: params.name }),
      ...(params.note !== undefined && { note: params.note }),
      updatedAt: new Date(),
    })
    .where(eq(accounts.id, accountId));

  await writeAuditLog({
    userId,
    action: 'update',
    resourceType: 'account',
    resourceId: accountId,
    changes: { before: existing, after: params },
    toolName: 'update_account',
  });
}

export async function deleteAccount(
  accountId: string,
  userId: string,
  force: boolean = false
): Promise<void> {
  const [existing] = await db
    .select()
    .from(accounts)
    .where(and(eq(accounts.id, accountId), eq(accounts.userId, userId), isNull(accounts.deletedAt)))
    .limit(1);

  if (!existing) {
    throw new FinanceError('NOT_FOUND', `账户 ${accountId} 不存在`);
  }

  // 检查是否有未删除的关联交易
  const [txCount] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(transactions)
    .where(
      and(
        eq(transactions.accountId, accountId),
        isNull(transactions.deletedAt)
      )
    );

  if ((txCount?.count ?? 0) > 0 && !force) {
    throw new FinanceError(
      'ACCOUNT_HAS_TRANSACTIONS',
      `账户下有 ${txCount.count} 条交易记录，请先处理或使用 force=true 强制删除`
    );
  }

  if (force && (txCount?.count ?? 0) > 0) {
    // 软删除所有关联交易
    await db
      .update(transactions)
      .set({ deletedAt: new Date(), deletedReason: '账户被强制删除' })
      .where(and(eq(transactions.accountId, accountId), isNull(transactions.deletedAt)));
  }

  await db
    .update(accounts)
    .set({ deletedAt: new Date(), isActive: false })
    .where(eq(accounts.id, accountId));

  await writeAuditLog({
    userId,
    action: 'delete',
    resourceType: 'account',
    resourceId: accountId,
    toolName: 'delete_account',
  });
}

export async function listAccounts(params: {
  userId: string;
  includeDeleted?: boolean;
  type?: string;
}): Promise<AccountListResult> {
  // 计算账户实时余额
  const balanceQuery = await db.execute(sql`
    SELECT
      a.id,
      a.name,
      a.type,
      a.currency,
      a.note,
      a.created_at,
      a.initial_balance::numeric
        + COALESCE(SUM(CASE WHEN t.type = 'income' THEN t.amount ELSE 0 END), 0)::numeric
        - COALESCE(SUM(CASE WHEN t.type = 'expense' THEN t.amount ELSE 0 END), 0)::numeric
        + COALESCE(SUM(CASE WHEN t.type = 'transfer' AND t.to_account_id = a.id THEN t.amount ELSE 0 END), 0)::numeric
        - COALESCE(SUM(CASE WHEN t.type = 'transfer' AND t.account_id = a.id THEN t.amount ELSE 0 END), 0)::numeric
      AS current_balance
    FROM accounts a
    LEFT JOIN transactions t ON (t.account_id = a.id OR t.to_account_id = a.id)
      AND t.deleted_at IS NULL
    WHERE a.user_id = ${params.userId}
      ${params.includeDeleted ? sql`` : sql`AND a.deleted_at IS NULL`}
      ${params.type ? sql`AND a.type = ${params.type}` : sql``}
    GROUP BY a.id, a.name, a.type, a.currency, a.note, a.created_at, a.initial_balance
    ORDER BY a.sort_order, a.created_at
  `);

  const accountList: AccountWithBalance[] = (balanceQuery as Array<Record<string, unknown>>).map((row) => ({
    account_id: row.id as string,
    name: row.name as string,
    type: row.type as string,
    balance: formatAmount(String(row.current_balance)),
    currency: row.currency as string,
    note: row.note as string | null,
    created_at: String(row.created_at),
  }));

  // 计算净资产汇总
  let totalAssets = 0;
  let totalLiabilities = 0;

  for (const acc of accountList) {
    if (acc.balance >= 0) {
      totalAssets += acc.balance;
    } else {
      totalLiabilities += Math.abs(acc.balance);
    }
  }

  return {
    accounts: accountList,
    summary: {
      total_assets: parseFloat(totalAssets.toFixed(2)),
      total_liabilities: parseFloat(totalLiabilities.toFixed(2)),
      net_worth: parseFloat((totalAssets - totalLiabilities).toFixed(2)),
    },
  };
}

export async function adjustAccountBalance(params: {
  userId: string;
  accountId: string;
  actualBalance: number;
  note?: string;
}): Promise<{ difference: number }> {
  const { userId, accountId, actualBalance, note } = params;

  // 查询账户当前余额（动态计算值）
  const result = await listAccounts({ userId, includeDeleted: false });
  const account = result.accounts.find((a) => a.account_id === accountId);

  if (!account) {
    throw new FinanceError('NOT_FOUND', `账户 ${accountId} 不存在`);
  }

  const difference = actualBalance - account.balance;
  if (Math.abs(difference) < 0.01) {
    throw new FinanceError('CONFLICT', `账户余额已经是 ${actualBalance} 元，无需调整`);
  }

  // 直接更新 initial_balance，使动态余额等于目标值
  // 新 initial_balance = 旧 initial_balance + 差值
  const [existing] = await db
    .select({ initialBalance: accounts.initialBalance })
    .from(accounts)
    .where(eq(accounts.id, accountId))
    .limit(1);

  const newInitialBalance = parseFloat(
    (parseFloat(existing.initialBalance) + difference).toFixed(2)
  );

  await db
    .update(accounts)
    .set({ initialBalance: String(newInitialBalance), updatedAt: new Date() })
    .where(eq(accounts.id, accountId));

  await writeAuditLog({
    userId,
    action: 'update',
    resourceType: 'account',
    resourceId: accountId,
    changes: {
      before: { balance: account.balance, initial_balance: parseFloat(existing.initialBalance) },
      after: { balance: actualBalance, initial_balance: newInitialBalance, note: note ?? `余额校正：调整至 ${actualBalance} 元` },
    },
    toolName: 'adjust_account_balance',
  });

  return { difference };
}
