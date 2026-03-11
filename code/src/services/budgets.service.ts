import { db } from '../db/client.js';
import { budgets, categories, transactions } from '../db/schema.js';
import { eq, and, sql } from 'drizzle-orm';
import { FinanceError } from '../utils/errors.js';
import { writeAuditLog } from '../utils/audit.js';
import { formatAmount } from '../utils/response.js';

export async function setCategoryBudget(params: {
  userId: string;
  categoryId: string;
  amount: number;
  yearMonth?: string;
  alertThreshold?: number;
  recurring?: boolean;
}): Promise<void> {
  const {
    userId,
    categoryId,
    amount,
    yearMonth = getCurrentYearMonth(),
    alertThreshold = 80,
    recurring = true,
  } = params;

  // 验证分类存在
  const [cat] = await db
    .select({ id: categories.id, name: categories.name })
    .from(categories)
    .where(eq(categories.id, categoryId))
    .limit(1);

  if (!cat) {
    throw new FinanceError('NOT_FOUND', `分类 ${categoryId} 不存在`);
  }

  await db
    .insert(budgets)
    .values({
      userId,
      yearMonth,
      categoryId,
      amount: String(amount),
      alertThreshold,
      recurring,
    })
    .onConflictDoUpdate({
      target: [budgets.userId, budgets.yearMonth, budgets.categoryId],
      set: {
        amount: String(amount),
        alertThreshold,
        recurring,
        updatedAt: new Date(),
      },
    });

  await writeAuditLog({
    userId,
    action: 'create',
    resourceType: 'budget',
    resourceId: categoryId,
    changes: { after: params },
    toolName: 'set_category_budget',
  });
}

export interface BudgetStatusItem {
  category_id: string;
  category_name: string;
  parent_category_name?: string;
  budget: number;
  spent: number;
  remaining: number;
  used_percent: number;
  status: 'normal' | 'warning' | 'exceeded' | 'no_budget';
}

export async function getBudgetStatus(params: {
  userId: string;
  yearMonth?: string;
}): Promise<{ year_month: string; categories: BudgetStatusItem[]; unbudgeted_spend: number }> {
  const { userId, yearMonth = getCurrentYearMonth() } = params;

  // 查询当月预算
  const budgetList = await db
    .select({
      categoryId: budgets.categoryId,
      amount: budgets.amount,
      alertThreshold: budgets.alertThreshold,
      categoryName: categories.name,
      parentId: categories.parentId,
    })
    .from(budgets)
    .innerJoin(categories, eq(categories.id, budgets.categoryId))
    .where(and(eq(budgets.userId, userId), eq(budgets.yearMonth, yearMonth)));

  const result: BudgetStatusItem[] = [];
  const budgetedCategoryIds = new Set<string>();

  for (const budget of budgetList) {
    budgetedCategoryIds.add(budget.categoryId);

    // 计算当月支出（含子分类）
    const [spentResult] = await db.execute(sql`
      SELECT COALESCE(SUM(t.amount), 0)::numeric AS spent
      FROM transactions t
      JOIN categories c ON c.id = t.category_id
      WHERE t.user_id = ${userId}
        AND t.deleted_at IS NULL
        AND t.type = 'expense'
        AND (t.category_id = ${budget.categoryId} OR c.parent_id = ${budget.categoryId})
        AND TO_CHAR(t.occurred_at AT TIME ZONE 'Asia/Shanghai', 'YYYY-MM') = ${yearMonth}
    `) as Array<{ spent: string }>;

    const spent = formatAmount(spentResult?.spent);
    const budgetAmount = formatAmount(budget.amount);
    const remaining = parseFloat((budgetAmount - spent).toFixed(2));
    const usedPercent = budgetAmount > 0 ? Math.round((spent / budgetAmount) * 100) : 0;

    let parentName: string | undefined;
    if (budget.parentId) {
      const [parent] = await db
        .select({ name: categories.name })
        .from(categories)
        .where(eq(categories.id, budget.parentId))
        .limit(1);
      parentName = parent?.name;
    }

    const status: BudgetStatusItem['status'] =
      usedPercent > 100
        ? 'exceeded'
        : usedPercent >= budget.alertThreshold
        ? 'warning'
        : 'normal';

    result.push({
      category_id: budget.categoryId,
      category_name: budget.categoryName,
      parent_category_name: parentName,
      budget: budgetAmount,
      spent,
      remaining,
      used_percent: usedPercent,
      status,
    });
  }

  // 计算无预算分类的支出
  const [unbudgetedResult] = await db.execute(sql`
    SELECT COALESCE(SUM(t.amount), 0)::numeric AS total
    FROM transactions t
    WHERE t.user_id = ${userId}
      AND t.deleted_at IS NULL
      AND t.type = 'expense'
      AND TO_CHAR(t.occurred_at AT TIME ZONE 'Asia/Shanghai', 'YYYY-MM') = ${yearMonth}
      AND t.category_id NOT IN (
        SELECT category_id FROM budgets
        WHERE user_id = ${userId} AND year_month = ${yearMonth}
      )
  `) as Array<{ total: string }>;

  return {
    year_month: yearMonth,
    categories: result,
    unbudgeted_spend: formatAmount(unbudgetedResult?.total),
  };
}

function getCurrentYearMonth(): string {
  const now = new Date();
  const tz = 'Asia/Shanghai';
  const dateStr = now.toLocaleString('zh-CN', { timeZone: tz, year: 'numeric', month: '2-digit' });
  return dateStr.replace(/\//g, '-').substring(0, 7);
}
