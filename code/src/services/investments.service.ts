import { db } from '../db/client.js';
import { investmentAccounts, investmentTransactions, investmentValuations } from '../db/schema.js';
import { eq, and, isNull, sql, desc } from 'drizzle-orm';
import { FinanceError } from '../utils/errors.js';
import { writeAuditLog } from '../utils/audit.js';
import { formatAmount } from '../utils/response.js';

export async function createInvestmentAccount(params: {
  userId: string;
  name: string;
  type: string;
  currency?: string;
  note?: string;
}): Promise<string> {
  const [account] = await db
    .insert(investmentAccounts)
    .values({
      userId: params.userId,
      name: params.name,
      type: params.type,
      currency: params.currency ?? 'CNY',
      note: params.note ?? null,
    })
    .returning({ id: investmentAccounts.id });

  await writeAuditLog({
    userId: params.userId,
    action: 'create',
    resourceType: 'investment_account',
    resourceId: account.id,
    changes: { after: params },
    toolName: 'record_investment_account',
  });

  return account.id;
}

export async function recordInvestmentTransaction(params: {
  userId: string;
  accountId: string;
  type: string;
  assetName: string;
  assetCode?: string;
  quantity?: number;
  price?: number;
  amount: number;
  date?: string;
  note?: string;
}): Promise<string> {
  const [account] = await db
    .select()
    .from(investmentAccounts)
    .where(and(eq(investmentAccounts.id, params.accountId), isNull(investmentAccounts.deletedAt)))
    .limit(1);

  if (!account) {
    throw new FinanceError('NOT_FOUND', `投资账户 ${params.accountId} 不存在`);
  }

  const [tx] = await db
    .insert(investmentTransactions)
    .values({
      accountId: params.accountId,
      userId: params.userId,
      type: params.type,
      assetName: params.assetName,
      assetCode: params.assetCode ?? null,
      quantity: params.quantity !== undefined ? String(params.quantity) : null,
      price: params.price !== undefined ? String(params.price) : null,
      amount: String(params.amount),
      date: params.date ?? new Date().toISOString().split('T')[0],
      note: params.note ?? null,
    })
    .returning({ id: investmentTransactions.id });

  return tx.id;
}

export async function listInvestmentHoldings(params: { userId: string; accountId?: string }) {
  const { userId, accountId } = params;

  const conditions = [
    sql`it.user_id = ${userId}`,
    sql`it.deleted_at IS NULL`,
  ];
  if (accountId) conditions.push(sql`it.account_id = ${accountId}`);

  const holdings = await db.execute(sql`
    SELECT
      it.account_id,
      ia.name AS account_name,
      it.asset_name,
      it.asset_code,
      SUM(CASE WHEN it.type = 'buy' THEN it.quantity ELSE -COALESCE(it.quantity, 0) END)::numeric AS total_quantity,
      SUM(CASE WHEN it.type = 'buy' THEN it.amount ELSE -it.amount END)::numeric AS net_cost,
      COUNT(*) AS transaction_count
    FROM investment_transactions it
    JOIN investment_accounts ia ON ia.id = it.account_id
    WHERE ${and(...conditions)}
      AND it.type IN ('buy', 'sell')
    GROUP BY it.account_id, ia.name, it.asset_name, it.asset_code
    HAVING SUM(CASE WHEN it.type = 'buy' THEN COALESCE(it.quantity, 0) ELSE -COALESCE(it.quantity, 0) END) > 0
    ORDER BY net_cost DESC
  `) as Array<{
    account_id: string;
    account_name: string;
    asset_name: string;
    asset_code: string | null;
    total_quantity: string;
    net_cost: string;
    transaction_count: string;
  }>;

  return {
    holdings: holdings.map((h) => ({
      account_id: h.account_id,
      account_name: h.account_name,
      asset_name: h.asset_name,
      asset_code: h.asset_code,
      total_quantity: parseFloat(String(h.total_quantity)),
      net_cost: formatAmount(h.net_cost),
    })),
  };
}

export async function updateInvestmentValuation(params: {
  userId: string;
  accountId: string;
  currentValue: number;
  valuationDate?: string;
}): Promise<void> {
  const date = params.valuationDate ?? new Date().toISOString().split('T')[0];

  await db
    .insert(investmentValuations)
    .values({
      accountId: params.accountId,
      userId: params.userId,
      currentValue: String(params.currentValue),
      valuationDate: date,
    })
    .onConflictDoUpdate({
      target: [investmentValuations.accountId, investmentValuations.valuationDate],
      set: { currentValue: String(params.currentValue) },
    });
}

export async function analyzeInvestmentReturn(params: { userId: string; accountId?: string }) {
  const { userId, accountId } = params;

  const conditions = [sql`it.user_id = ${userId}`, sql`it.deleted_at IS NULL`];
  if (accountId) conditions.push(sql`it.account_id = ${accountId}`);

  const costResult = await db.execute(sql`
    SELECT
      COALESCE(SUM(CASE WHEN type = 'buy' THEN amount ELSE -amount END), 0)::numeric AS net_cost,
      COALESCE(SUM(CASE WHEN type = 'dividend' THEN amount ELSE 0 END), 0)::numeric AS dividends
    FROM investment_transactions it
    WHERE ${and(...conditions)}
  `) as Array<{ net_cost: string; dividends: string }>;

  // 获取最新估值
  const latestValuation = await db.execute(sql`
    SELECT COALESCE(SUM(iv.current_value), 0)::numeric AS total_value
    FROM investment_valuations iv
    JOIN (
      SELECT account_id, MAX(valuation_date) AS max_date
      FROM investment_valuations
      WHERE user_id = ${userId}
        ${accountId ? sql`AND account_id = ${accountId}` : sql``}
      GROUP BY account_id
    ) latest ON iv.account_id = latest.account_id AND iv.valuation_date = latest.max_date
    WHERE iv.user_id = ${userId}
  `) as Array<{ total_value: string }>;

  const netCost = formatAmount(costResult[0]?.net_cost);
  const dividends = formatAmount(costResult[0]?.dividends);
  const currentValue = formatAmount(latestValuation[0]?.total_value);
  const profit = parseFloat((currentValue + dividends - netCost).toFixed(2));
  const returnRate = netCost > 0 ? parseFloat((profit / netCost * 100).toFixed(2)) : 0;

  return {
    net_cost: netCost,
    current_value: currentValue,
    dividends,
    profit,
    return_rate_pct: returnRate,
  };
}
