import { db } from '../db/client.js';
import { transactions, categories, accounts, budgets, auditLogs } from '../db/schema.js';
import { eq, and, isNull, sql, gte, lte, like, or, desc, asc, inArray } from 'drizzle-orm';
import { FinanceError } from '../utils/errors.js';
import { writeAuditLog } from '../utils/audit.js';
import { formatAmount, formatDateTimeCST } from '../utils/response.js';

export interface TagLabels {
  method?: string;
  behavior?: string;
  consumption_type?: string;
  scale?: string;
  purpose?: string;
}

export interface RecordTransactionParams {
  userId: string;
  type: 'income' | 'expense' | 'transfer';
  amount: number;
  categoryId?: string;
  accountId: string;
  toAccountId?: string;
  occurredAt?: string;
  note?: string;
  tagLabels?: TagLabels;
  sourceText?: string;
}

export interface BudgetWarning {
  category: string;
  used_percent: number;
  remaining: number;
  status: 'warning' | 'exceeded';
}

export interface RecordTransactionResult {
  transaction_id: string;
  message: string;
  budget_warning?: BudgetWarning;
  suggested_tag_labels?: TagLabels;
}

// ─── 服务端确定性标签规则（基于分类和金额，结果唯一确定）────────────────────
const NECESSARY_CATEGORIES = ['住房', '餐饮', '交通', '生活缴费', '医疗健康'];
const OPTIONAL_CATEGORIES = ['休闲娱乐', '形象管理', '旅行', '人情社交', '兴趣爱好', '耐用消费品'];
const SURVIVAL_CATEGORIES = ['住房', '医疗健康', '餐饮', '生活缴费'];
const DEVELOPMENT_CATEGORIES = ['学习进修', '兴趣爱好'];
const LEISURE_CATEGORIES = ['休闲娱乐', '旅行', '形象管理', '人情社交'];

/**
 * 服务端确定性标签推断：scale / consumption_type / purpose
 * 仅依赖金额和分类，结果确定、不受文本歧义影响
 */
function inferServerTags(params: {
  amount: number;
  categoryName?: string;
  parentCategoryName?: string;
}): Pick<TagLabels, 'scale' | 'consumption_type' | 'purpose'> {
  const { amount, categoryName, parentCategoryName } = params;
  const tags: Pick<TagLabels, 'scale' | 'consumption_type' | 'purpose'> = {};
  const topCategory = parentCategoryName ?? categoryName ?? '';

  // 金额规模：仅在大额时标记，小额为默认状态不写入
  const threshold = parseFloat(process.env.LARGE_EXPENSE_THRESHOLD ?? '500');
  if (amount >= threshold) {
    tags.scale = '大额支出';
  }

  // 消费类型
  if (NECESSARY_CATEGORIES.includes(topCategory)) {
    tags.consumption_type = '必选消费';
  } else if (OPTIONAL_CATEGORIES.includes(topCategory)) {
    tags.consumption_type = '可选消费';
  }

  // 消费目的
  if (SURVIVAL_CATEGORIES.includes(topCategory)) {
    tags.purpose = '生存必需';
  } else if (DEVELOPMENT_CATEGORIES.includes(topCategory)) {
    tags.purpose = '发展提升';
  } else if (LEISURE_CATEGORIES.includes(topCategory)) {
    tags.purpose = '享受休闲';
  }

  return tags;
}

/**
 * 合并标签：服务端确定性字段（scale/consumption_type/purpose）+ AI 情境字段（method/behavior）
 * 服务端字段始终覆盖 AI 传入的同名字段，防止 AI 误写确定性维度
 */
export function mergeTagLabels(
  aiTags: Pick<TagLabels, 'method' | 'behavior'> | null | undefined,
  serverTags: Pick<TagLabels, 'scale' | 'consumption_type' | 'purpose'>
): TagLabels {
  const merged: TagLabels = {};
  if (aiTags?.method) merged.method = aiTags.method;
  if (aiTags?.behavior) merged.behavior = aiTags.behavior;
  if (serverTags.scale) merged.scale = serverTags.scale;
  if (serverTags.consumption_type) merged.consumption_type = serverTags.consumption_type;
  if (serverTags.purpose) merged.purpose = serverTags.purpose;
  return merged;
}

/**
 * @deprecated 仅供 batch_record_transactions dry_run 模式兼容调用，不用于正式写库
 */
export function inferSuggestedTags(params: {
  amount: number;
  categoryName?: string;
  parentCategoryName?: string;
}): TagLabels {
  return inferServerTags(params);
}

/**
 * 检查分类预算预警
 */
async function checkBudgetWarning(
  categoryId: string,
  userId: string,
  yearMonth: string
): Promise<BudgetWarning | undefined> {
  const [budget] = await db
    .select()
    .from(budgets)
    .where(
      and(
        eq(budgets.userId, userId),
        eq(budgets.yearMonth, yearMonth),
        eq(budgets.categoryId, categoryId)
      )
    )
    .limit(1);

  if (!budget) return undefined;

  // 计算当月实际支出
  const [spentResult] = await db.execute(sql`
    SELECT COALESCE(SUM(t.amount), 0)::numeric AS spent
    FROM transactions t
    JOIN categories c ON c.id = t.category_id
    WHERE t.user_id = ${userId}
      AND t.deleted_at IS NULL
      AND t.type = 'expense'
      AND (t.category_id = ${categoryId} OR c.parent_id = ${categoryId})
      AND TO_CHAR(t.occurred_at AT TIME ZONE 'Asia/Shanghai', 'YYYY-MM') = ${yearMonth}
  `) as Array<{ spent: string }>;

  const spent = formatAmount(spentResult?.spent);
  const budgetAmount = formatAmount(budget.amount);
  const usedPercent = Math.round((spent / budgetAmount) * 100);

  if (usedPercent >= budget.alertThreshold) {
    const categoryResult = await db
      .select({ name: categories.name })
      .from(categories)
      .where(eq(categories.id, categoryId))
      .limit(1);

    return {
      category: categoryResult[0]?.name ?? categoryId,
      used_percent: usedPercent,
      remaining: parseFloat((budgetAmount - spent).toFixed(2)),
      status: usedPercent > 100 ? 'exceeded' : 'warning',
    };
  }

  return undefined;
}

export async function recordTransaction(
  params: RecordTransactionParams
): Promise<RecordTransactionResult> {
  const { userId, type, amount, categoryId, accountId, toAccountId, occurredAt, note, tagLabels, sourceText } = params;

  // 校验 transfer 类型需要 toAccountId
  if (type === 'transfer' && !toAccountId) {
    throw new FinanceError('INVALID_TRANSFER', '转账类型必须提供目标账户 to_account_id');
  }

  // expense 类型：预先查询分类信息用于标签推断
  let categoryName: string | undefined;
  let parentCategoryName: string | undefined;

  if (type === 'expense' && categoryId) {
    const [cat] = await db
      .select({ name: categories.name, parentId: categories.parentId })
      .from(categories)
      .where(eq(categories.id, categoryId))
      .limit(1);
    categoryName = cat?.name;
    if (cat?.parentId) {
      const [parent] = await db
        .select({ name: categories.name })
        .from(categories)
        .where(eq(categories.id, cat.parentId))
        .limit(1);
      parentCategoryName = parent?.name;
    }
  }

  // 分层标签合并：
  // - 服务端计算 scale/consumption_type/purpose（确定性，基于金额和分类）
  // - AI 提供 method/behavior（情境性，无明确信号时应留空）
  // - 服务端字段始终覆盖 AI 传入的同名字段
  let effectiveTagLabels: TagLabels | null = null;
  if (type === 'expense') {
    const serverTags = inferServerTags({ amount, categoryName, parentCategoryName });
    effectiveTagLabels = mergeTagLabels(tagLabels ?? null, serverTags);
  }

  const occurredDate = occurredAt ? new Date(occurredAt) : new Date();

  const [tx] = await db
    .insert(transactions)
    .values({
      userId,
      type,
      amount: String(amount),
      categoryId: categoryId ?? null,
      accountId,
      toAccountId: toAccountId ?? null,
      occurredAt: occurredDate,
      note: note ?? null,
      tagLabels: effectiveTagLabels,
      sourceText: sourceText ?? null,
    })
    .returning({ id: transactions.id });

  await writeAuditLog({
    userId,
    action: 'create',
    resourceType: 'transaction',
    resourceId: tx.id,
    changes: { after: params },
    toolName: 'record_transaction',
  });

  // 查询账户信息构建响应消息
  const [account] = await db
    .select({ name: accounts.name })
    .from(accounts)
    .where(eq(accounts.id, accountId))
    .limit(1);

  const typeText = type === 'income' ? '收入' : type === 'expense' ? '支出' : '转账';
  let message = `已记录${typeText} ${amount.toFixed(2)} 元`;

  if (categoryId) {
    const [cat] = await db
      .select({ name: categories.name, parentId: categories.parentId })
      .from(categories)
      .where(eq(categories.id, categoryId))
      .limit(1);

    if (cat) {
      if (cat.parentId) {
        const [parent] = await db
          .select({ name: categories.name })
          .from(categories)
          .where(eq(categories.id, cat.parentId))
          .limit(1);
        message += `（${parent?.name ?? ''}/${cat.name}）`;
      } else {
        message += `（${cat.name}）`;
      }
    }
  }

  if (account) {
    message += `，账户「${account.name}」`;
  }

  const result: RecordTransactionResult = {
    transaction_id: tx.id,
    message,
  };

  // 检查预算预警
  if (type === 'expense' && categoryId) {
    const yearMonth = occurredDate.toLocaleString('zh-CN', {
      timeZone: 'Asia/Shanghai',
      year: 'numeric',
      month: '2-digit',
    }).replace(/\//g, '-').substring(0, 7);

    const warning = await checkBudgetWarning(categoryId, userId, yearMonth);
    if (warning) {
      result.budget_warning = warning;
    }
  }

  // 将最终写库的标签回传给调用方（供展示用）
  if (effectiveTagLabels && Object.keys(effectiveTagLabels).length > 0) {
    result.suggested_tag_labels = effectiveTagLabels;
  }

  return result;
}

export interface UpdateTransactionParams {
  amount?: number;
  categoryId?: string;
  accountId?: string;
  occurredAt?: string;
  note?: string;
  tagLabels?: Partial<TagLabels> | null;
}

export async function updateTransaction(
  transactionId: string,
  userId: string,
  params: UpdateTransactionParams
): Promise<void> {
  const [existing] = await db
    .select()
    .from(transactions)
    .where(
      and(
        eq(transactions.id, transactionId),
        eq(transactions.userId, userId),
        isNull(transactions.deletedAt)
      )
    )
    .limit(1);

  if (!existing) {
    throw new FinanceError('NOT_FOUND', `交易记录 ${transactionId} 不存在`);
  }

  const updateData: Record<string, unknown> = { updatedAt: new Date() };

  if (params.amount !== undefined) updateData.amount = String(params.amount);
  if (params.categoryId !== undefined) updateData.categoryId = params.categoryId;
  if (params.accountId !== undefined) updateData.accountId = params.accountId;
  if (params.occurredAt !== undefined) updateData.occurredAt = new Date(params.occurredAt);
  if (params.note !== undefined) updateData.note = params.note;
  if (params.tagLabels !== undefined) {
    if (params.tagLabels === null) {
      updateData.tagLabels = null;
    } else {
      // 合并现有标签
      const existingTags = (existing.tagLabels as TagLabels) ?? {};
      updateData.tagLabels = { ...existingTags, ...params.tagLabels };
    }
  }

  await db.update(transactions).set(updateData as Partial<typeof transactions.$inferInsert>).where(eq(transactions.id, transactionId));

  await writeAuditLog({
    userId,
    action: 'update',
    resourceType: 'transaction',
    resourceId: transactionId,
    changes: { before: existing, after: params },
    toolName: 'update_transaction',
  });
}

export async function deleteTransaction(
  transactionId: string,
  userId: string,
  reason?: string
): Promise<void> {
  const [existing] = await db
    .select()
    .from(transactions)
    .where(
      and(
        eq(transactions.id, transactionId),
        eq(transactions.userId, userId),
        isNull(transactions.deletedAt)
      )
    )
    .limit(1);

  if (!existing) {
    throw new FinanceError('NOT_FOUND', `交易记录 ${transactionId} 不存在`);
  }

  await db
    .update(transactions)
    .set({
      deletedAt: new Date(),
      deletedReason: reason ?? null,
      updatedAt: new Date(),
    })
    .where(eq(transactions.id, transactionId));

  await writeAuditLog({
    userId,
    action: 'delete',
    resourceType: 'transaction',
    resourceId: transactionId,
    changes: { before: existing },
    toolName: 'delete_transaction',
  });
}

export interface ListTransactionsParams {
  userId: string;
  transactionId?: string;
  includeHistory?: boolean;
  startDate?: string;
  endDate?: string;
  type?: 'income' | 'expense' | 'transfer' | 'all';
  categoryId?: string;
  accountId?: string;
  minAmount?: number;
  maxAmount?: number;
  keyword?: string;
  tagFilter?: Partial<TagLabels>;
  page?: number;
  pageSize?: number;
  order?: 'date_desc' | 'date_asc' | 'amount_desc' | 'amount_asc';
}

export async function listTransactions(params: ListTransactionsParams) {
  const {
    userId,
    transactionId,
    includeHistory = false,
    startDate,
    endDate,
    type,
    categoryId,
    accountId,
    minAmount,
    maxAmount,
    keyword,
    tagFilter,
    page = 1,
    pageSize = 50,
    order = 'date_desc',
  } = params;

  // 单条查询
  if (transactionId) {
    const [tx] = await db
      .select()
      .from(transactions)
      .where(and(eq(transactions.id, transactionId), eq(transactions.userId, userId)))
      .limit(1);

    if (!tx) {
      throw new FinanceError('NOT_FOUND', `交易记录 ${transactionId} 不存在`);
    }

    let history: AuditLog[] = [];
    if (includeHistory) {
      history = await db
        .select()
        .from(auditLogs)
        .where(
          and(
            eq(auditLogs.resourceType, 'transaction'),
            eq(auditLogs.resourceId, transactionId)
          )
        )
        .orderBy(desc(auditLogs.createdAt));
    }

    const formattedTx = {
      ...tx,
      occurred_at: formatDateTimeCST(tx.occurredAt),
      created_at: formatDateTimeCST(tx.createdAt),
      updated_at: formatDateTimeCST(tx.updatedAt),
      history: includeHistory ? history : undefined,
    };

    return {
      items: [formattedTx],
      pagination: { page: 1, page_size: 1, total: 1, total_pages: 1 },
      summary: { total_income: 0, total_expense: 0 },
    };
  }

  // 构建过滤条件（默认排除系统自动生成的余额调整交易）
  const conditions = [
    eq(transactions.userId, userId),
    isNull(transactions.deletedAt),
    eq(transactions.isSystem, false),
  ];

  if (type && type !== 'all') conditions.push(eq(transactions.type, type));
  if (categoryId) conditions.push(eq(transactions.categoryId, categoryId));
  if (accountId) conditions.push(eq(transactions.accountId, accountId));
  if (minAmount !== undefined) conditions.push(gte(transactions.amount, String(minAmount)));
  if (maxAmount !== undefined) conditions.push(lte(transactions.amount, String(maxAmount)));
  if (startDate) {
    conditions.push(gte(transactions.occurredAt, new Date(startDate + 'T00:00:00+08:00')));
  }
  if (endDate) {
    conditions.push(lte(transactions.occurredAt, new Date(endDate + 'T23:59:59+08:00')));
  }
  if (keyword) {
    conditions.push(
      or(
        like(transactions.note, `%${keyword}%`),
        like(transactions.sourceText, `%${keyword}%`)
      )!
    );
  }
  if (tagFilter) {
    for (const [key, value] of Object.entries(tagFilter)) {
      if (value) {
        conditions.push(sql`${transactions.tagLabels}->>${key} = ${value}`);
      }
    }
  }

  // 排序
  const orderClause =
    order === 'date_asc'
      ? asc(transactions.occurredAt)
      : order === 'amount_desc'
      ? desc(transactions.amount)
      : order === 'amount_asc'
      ? asc(transactions.amount)
      : desc(transactions.occurredAt);

  const offset = (page - 1) * pageSize;

  const [totalResult, items] = await Promise.all([
    db
      .select({ count: sql<number>`count(*)::int` })
      .from(transactions)
      .where(and(...conditions)),
    db
      .select()
      .from(transactions)
      .where(and(...conditions))
      .orderBy(orderClause)
      .limit(pageSize)
      .offset(offset),
  ]);

  const total = totalResult[0]?.count ?? 0;

  // 当页收支汇总
  const summaryResult = await db.execute(sql`
    SELECT
      COALESCE(SUM(CASE WHEN type = 'income' THEN amount ELSE 0 END), 0)::numeric AS total_income,
      COALESCE(SUM(CASE WHEN type = 'expense' THEN amount ELSE 0 END), 0)::numeric AS total_expense
    FROM transactions
    WHERE ${and(...conditions)}
    LIMIT ${pageSize}
    OFFSET ${offset}
  `) as Array<{ total_income: string; total_expense: string }>;

  const formattedItems = items.map((item) => ({
    ...item,
    occurred_at: formatDateTimeCST(item.occurredAt),
    created_at: formatDateTimeCST(item.createdAt),
    updated_at: formatDateTimeCST(item.updatedAt),
  }));

  return {
    items: formattedItems,
    pagination: {
      page,
      page_size: pageSize,
      total,
      total_pages: Math.ceil(total / pageSize),
    },
    summary: {
      total_income: formatAmount(summaryResult[0]?.total_income),
      total_expense: formatAmount(summaryResult[0]?.total_expense),
    },
  };
}

type AuditLog = typeof auditLogs.$inferSelect;
