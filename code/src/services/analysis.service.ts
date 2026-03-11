import { db } from '../db/client.js';
import { transactions, categories, amortizations, budgets } from '../db/schema.js';
import { eq, and, isNull, sql, desc, lte, gte } from 'drizzle-orm';
import { formatAmount } from '../utils/response.js';

function getCurrentYearMonth(): string {
  const now = new Date();
  return now.toLocaleString('zh-CN', { timeZone: 'Asia/Shanghai', year: 'numeric', month: '2-digit' })
    .replace(/\//g, '-').substring(0, 7);
}

function addMonths(yearMonth: string, n: number): string {
  const [year, month] = yearMonth.split('-').map(Number);
  const date = new Date(year, month - 1 + n, 1);
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
}

/**
 * 计算指定月份的分摊调整金额（分摊金额 - 原始交易金额在该月的贡献）
 */
async function getAmortizedAdjustment(userId: string, yearMonth: string): Promise<number> {
  const result = await db.execute(sql`
    WITH amort_months AS (
      SELECT
        a.id,
        a.transaction_id,
        a.monthly_amount::numeric,
        a.total_amount::numeric,
        a.total_months,
        a.start_month,
        -- 计算该月是否在分摊范围内
        (TO_DATE(${yearMonth}, 'YYYY-MM') >= TO_DATE(a.start_month, 'YYYY-MM')
          AND TO_DATE(${yearMonth}, 'YYYY-MM') <= TO_DATE(a.start_month, 'YYYY-MM') + ((a.total_months - 1) * INTERVAL '1 month'))
          AS in_range,
        -- 是否是最后一个月
        TO_CHAR(TO_DATE(a.start_month, 'YYYY-MM') + ((a.total_months - 1) * INTERVAL '1 month'), 'YYYY-MM') = ${yearMonth}
          AS is_last_month
      FROM amortizations a
      WHERE a.user_id = ${userId} AND a.status != 'cancelled'
    )
    SELECT
      COALESCE(SUM(
        CASE
          WHEN is_last_month THEN total_amount - monthly_amount * (total_months - 1)
          ELSE monthly_amount
        END
      ) - SUM(
        CASE WHEN in_range THEN t.amount ELSE 0 END
      ), 0)::numeric AS adjustment
    FROM amort_months am
    JOIN transactions t ON t.id = am.transaction_id
    WHERE am.in_range
  `) as Array<{ adjustment: string }>;

  return formatAmount(result[0]?.adjustment);
}

export async function analyzeMonthlySummary(params: {
  userId: string;
  yearMonth?: string;
  accountId?: string;
  includeBudgetComparison?: boolean;
  includeAmortized?: boolean;
}) {
  const { userId, yearMonth = getCurrentYearMonth(), accountId, includeBudgetComparison = false, includeAmortized = true } = params;

  const conditions = [
    sql`t.user_id = ${userId}`,
    sql`t.deleted_at IS NULL`,
    sql`TO_CHAR(t.occurred_at AT TIME ZONE 'Asia/Shanghai', 'YYYY-MM') = ${yearMonth}`,
  ];

  if (accountId) conditions.push(sql`t.account_id = ${accountId}`);

  const summary = await db.execute(sql`
    SELECT
      COALESCE(SUM(CASE WHEN t.type = 'income' THEN t.amount ELSE 0 END), 0)::numeric AS total_income,
      COALESCE(SUM(CASE WHEN t.type = 'expense' THEN t.amount ELSE 0 END), 0)::numeric AS total_expense,
      COUNT(CASE WHEN t.type = 'expense' THEN 1 END) AS expense_count
    FROM transactions t
    WHERE ${and(...conditions)}
  `) as Array<{ total_income: string; total_expense: string; expense_count: string }>;

  const categoryBreakdown = await db.execute(sql`
    SELECT
      COALESCE(p.name, c.name) AS category_name,
      c.name AS sub_category_name,
      CASE WHEN c.parent_id IS NOT NULL THEN TRUE ELSE FALSE END AS is_sub,
      COALESCE(SUM(t.amount), 0)::numeric AS amount,
      COUNT(*) AS count
    FROM transactions t
    JOIN categories c ON c.id = t.category_id
    LEFT JOIN categories p ON p.id = c.parent_id
    WHERE ${and(...conditions)}
      AND t.type = 'expense'
    GROUP BY COALESCE(p.name, c.name), c.name, is_sub
    ORDER BY amount DESC
  `) as Array<{
    category_name: string;
    sub_category_name: string;
    is_sub: boolean;
    amount: string;
    count: string;
  }>;

  // 上月对比
  const prevMonth = addMonths(yearMonth, -1);
  const prevSummary = await db.execute(sql`
    SELECT
      COALESCE(SUM(CASE WHEN type = 'income' THEN amount ELSE 0 END), 0)::numeric AS prev_income,
      COALESCE(SUM(CASE WHEN type = 'expense' THEN amount ELSE 0 END), 0)::numeric AS prev_expense
    FROM transactions
    WHERE user_id = ${userId}
      AND deleted_at IS NULL
      AND TO_CHAR(occurred_at AT TIME ZONE 'Asia/Shanghai', 'YYYY-MM') = ${prevMonth}
      ${accountId ? sql`AND account_id = ${accountId}` : sql``}
  `) as Array<{ prev_income: string; prev_expense: string }>;

  const totalIncome = formatAmount(summary[0]?.total_income);
  let totalExpense = formatAmount(summary[0]?.total_expense);

  let amortizationAdjustment = 0;
  if (includeAmortized) {
    amortizationAdjustment = await getAmortizedAdjustment(userId, yearMonth);
    totalExpense = parseFloat((totalExpense + amortizationAdjustment).toFixed(2));
  }

  const prevIncome = formatAmount(prevSummary[0]?.prev_income);
  const prevExpense = formatAmount(prevSummary[0]?.prev_expense);

  return {
    year_month: yearMonth,
    total_income: totalIncome,
    total_expense: totalExpense,
    net_balance: parseFloat((totalIncome - totalExpense).toFixed(2)),
    amortization_adjustment: amortizationAdjustment,
    category_breakdown: categoryBreakdown.map((row) => ({
      category_name: row.category_name,
      sub_category_name: row.is_sub ? row.sub_category_name : undefined,
      amount: formatAmount(row.amount),
      transaction_count: parseInt(String(row.count), 10),
    })),
    comparison_with_prev_month: {
      prev_income: prevIncome,
      prev_expense: prevExpense,
      income_change_pct: prevIncome > 0 ? parseFloat(((totalIncome - prevIncome) / prevIncome * 100).toFixed(1)) : null,
      expense_change_pct: prevExpense > 0 ? parseFloat(((totalExpense - prevExpense) / prevExpense * 100).toFixed(1)) : null,
    },
  };
}

export async function analyzeYearlySummary(params: { userId: string; year?: number }) {
  const { userId, year = new Date().getFullYear() } = params;

  const yearStr = String(year);

  const monthly = await db.execute(sql`
    SELECT
      TO_CHAR(occurred_at AT TIME ZONE 'Asia/Shanghai', 'YYYY-MM') AS year_month,
      COALESCE(SUM(CASE WHEN type = 'income' THEN amount ELSE 0 END), 0)::numeric AS income,
      COALESCE(SUM(CASE WHEN type = 'expense' THEN amount ELSE 0 END), 0)::numeric AS expense
    FROM transactions
    WHERE user_id = ${userId}
      AND deleted_at IS NULL
      AND TO_CHAR(occurred_at AT TIME ZONE 'Asia/Shanghai', 'YYYY') = ${yearStr}
    GROUP BY year_month
    ORDER BY year_month
  `) as Array<{ year_month: string; income: string; expense: string }>;

  const topCategories = await db.execute(sql`
    SELECT
      COALESCE(p.name, c.name) AS category_name,
      SUM(t.amount)::numeric AS total
    FROM transactions t
    JOIN categories c ON c.id = t.category_id
    LEFT JOIN categories p ON p.id = c.parent_id
    WHERE t.user_id = ${userId}
      AND t.deleted_at IS NULL
      AND t.type = 'expense'
      AND TO_CHAR(t.occurred_at AT TIME ZONE 'Asia/Shanghai', 'YYYY') = ${yearStr}
    GROUP BY COALESCE(p.name, c.name)
    ORDER BY total DESC
    LIMIT 5
  `) as Array<{ category_name: string; total: string }>;

  const yearlyTotals = monthly.reduce(
    (acc, m) => ({
      income: acc.income + formatAmount(m.income),
      expense: acc.expense + formatAmount(m.expense),
    }),
    { income: 0, expense: 0 }
  );

  return {
    year,
    total_income: parseFloat(yearlyTotals.income.toFixed(2)),
    total_expense: parseFloat(yearlyTotals.expense.toFixed(2)),
    net_balance: parseFloat((yearlyTotals.income - yearlyTotals.expense).toFixed(2)),
    monthly_breakdown: monthly.map((m) => ({
      year_month: m.year_month,
      income: formatAmount(m.income),
      expense: formatAmount(m.expense),
      net_balance: parseFloat((formatAmount(m.income) - formatAmount(m.expense)).toFixed(2)),
    })),
    top_5_expense_categories: topCategories.map((c) => ({
      category_name: c.category_name,
      total: formatAmount(c.total),
    })),
  };
}

export async function analyzeCategoryTrend(params: {
  userId: string;
  categoryId: string;
  months?: number;
}) {
  const { userId, categoryId, months = 6 } = params;

  const endMonth = getCurrentYearMonth();
  const startMonth = addMonths(endMonth, -(months - 1));

  const trend = await db.execute(sql`
    SELECT
      TO_CHAR(t.occurred_at AT TIME ZONE 'Asia/Shanghai', 'YYYY-MM') AS year_month,
      COALESCE(SUM(t.amount), 0)::numeric AS amount,
      COUNT(*) AS count
    FROM transactions t
    JOIN categories c ON c.id = t.category_id
    WHERE t.user_id = ${userId}
      AND t.deleted_at IS NULL
      AND t.type = 'expense'
      AND (t.category_id = ${categoryId} OR c.parent_id = ${categoryId})
      AND TO_CHAR(t.occurred_at AT TIME ZONE 'Asia/Shanghai', 'YYYY-MM') >= ${startMonth}
      AND TO_CHAR(t.occurred_at AT TIME ZONE 'Asia/Shanghai', 'YYYY-MM') <= ${endMonth}
    GROUP BY year_month
    ORDER BY year_month
  `) as Array<{ year_month: string; amount: string; count: string }>;

  const trendData = trend.map((row, i) => {
    const prevAmount = i > 0 ? formatAmount(trend[i - 1].amount) : null;
    const currentAmount = formatAmount(row.amount);
    return {
      year_month: row.year_month,
      amount: currentAmount,
      transaction_count: parseInt(String(row.count), 10),
      mom_change_pct: prevAmount && prevAmount > 0
        ? parseFloat(((currentAmount - prevAmount) / prevAmount * 100).toFixed(1))
        : null,
    };
  });

  return { category_id: categoryId, months, trend: trendData };
}

export async function analyzeTopExpenses(params: {
  userId: string;
  startDate?: string;
  endDate?: string;
  topN?: number;
  categoryId?: string;
  accountId?: string;
}) {
  const { userId, startDate, endDate, topN = 10, categoryId, accountId } = params;

  const conditions = [
    sql`t.user_id = ${userId}`,
    sql`t.deleted_at IS NULL`,
    sql`t.type = 'expense'`,
  ];

  if (startDate) conditions.push(sql`t.occurred_at >= ${startDate}::date`);
  if (endDate) conditions.push(sql`t.occurred_at <= (${endDate}::date + INTERVAL '1 day')`);
  if (categoryId) conditions.push(sql`(t.category_id = ${categoryId} OR c.parent_id = ${categoryId})`);
  if (accountId) conditions.push(sql`t.account_id = ${accountId}`);

  const top = await db.execute(sql`
    SELECT
      t.id,
      t.amount::numeric,
      t.note,
      t.occurred_at,
      COALESCE(p.name, c.name) AS category_name,
      a.name AS account_name
    FROM transactions t
    LEFT JOIN categories c ON c.id = t.category_id
    LEFT JOIN categories p ON p.id = c.parent_id
    LEFT JOIN accounts a ON a.id = t.account_id
    WHERE ${and(...conditions)}
    ORDER BY t.amount DESC
    LIMIT ${topN}
  `) as Array<{
    id: string;
    amount: string;
    note: string | null;
    occurred_at: string;
    category_name: string | null;
    account_name: string | null;
  }>;

  return {
    top_n: topN,
    expenses: top.map((row) => ({
      transaction_id: row.id,
      amount: formatAmount(row.amount),
      note: row.note,
      occurred_at: String(row.occurred_at),
      category_name: row.category_name,
      account_name: row.account_name,
    })),
  };
}

export async function analyzeCashFlow(params: {
  userId: string;
  period?: 'daily' | 'weekly' | 'monthly';
  months?: number;
  accountId?: string;
}) {
  const { userId, period = 'monthly', months = 3, accountId } = params;

  const endMonth = getCurrentYearMonth();
  const startMonth = addMonths(endMonth, -(months - 1));

  const groupFormat =
    period === 'daily'
      ? "TO_CHAR(occurred_at AT TIME ZONE 'Asia/Shanghai', 'YYYY-MM-DD')"
      : period === 'weekly'
      ? "TO_CHAR(DATE_TRUNC('week', occurred_at AT TIME ZONE 'Asia/Shanghai'), 'YYYY-MM-DD')"
      : "TO_CHAR(occurred_at AT TIME ZONE 'Asia/Shanghai', 'YYYY-MM')";

  const result = await db.execute(sql`
    SELECT
      ${sql.raw(groupFormat)} AS period,
      COALESCE(SUM(CASE WHEN type = 'income' THEN amount ELSE 0 END), 0)::numeric AS inflow,
      COALESCE(SUM(CASE WHEN type = 'expense' THEN amount ELSE 0 END), 0)::numeric AS outflow
    FROM transactions
    WHERE user_id = ${userId}
      AND deleted_at IS NULL
      AND TO_CHAR(occurred_at AT TIME ZONE 'Asia/Shanghai', 'YYYY-MM') >= ${startMonth}
      AND TO_CHAR(occurred_at AT TIME ZONE 'Asia/Shanghai', 'YYYY-MM') <= ${endMonth}
      ${accountId ? sql`AND account_id = ${accountId}` : sql``}
    GROUP BY period
    ORDER BY period
  `) as Array<{ period: string; inflow: string; outflow: string }>;

  return {
    period,
    months,
    cash_flow: result.map((row) => ({
      period: row.period,
      inflow: formatAmount(row.inflow),
      outflow: formatAmount(row.outflow),
      net: parseFloat((formatAmount(row.inflow) - formatAmount(row.outflow)).toFixed(2)),
    })),
  };
}

export async function analyzeSpendingPattern(params: {
  userId: string;
  startDate?: string;
  endDate?: string;
  categoryId?: string;
}) {
  const { userId, startDate, endDate, categoryId } = params;

  const conditions = [
    sql`user_id = ${userId}`,
    sql`deleted_at IS NULL`,
    sql`type = 'expense'`,
  ];

  if (startDate) conditions.push(sql`occurred_at >= ${startDate}::date`);
  if (endDate) conditions.push(sql`occurred_at <= (${endDate}::date + INTERVAL '1 day')`);
  if (categoryId) conditions.push(sql`category_id = ${categoryId}`);

  // 按星期分布
  const weekdayDist = await db.execute(sql`
    SELECT
      EXTRACT(DOW FROM occurred_at AT TIME ZONE 'Asia/Shanghai')::int AS day_of_week,
      TO_CHAR(occurred_at AT TIME ZONE 'Asia/Shanghai', 'Day') AS day_name,
      COUNT(*) AS count,
      SUM(amount)::numeric AS total
    FROM transactions
    WHERE ${and(...conditions)}
    GROUP BY day_of_week, day_name
    ORDER BY day_of_week
  `) as Array<{ day_of_week: number; day_name: string; count: string; total: string }>;

  // 按小时分布
  const hourDist = await db.execute(sql`
    SELECT
      EXTRACT(HOUR FROM occurred_at AT TIME ZONE 'Asia/Shanghai')::int AS hour,
      COUNT(*) AS count,
      SUM(amount)::numeric AS total
    FROM transactions
    WHERE ${and(...conditions)}
    GROUP BY hour
    ORDER BY count DESC
    LIMIT 5
  `) as Array<{ hour: number; count: string; total: string }>;

  return {
    weekday_distribution: weekdayDist.map((row) => ({
      day_of_week: row.day_of_week,
      day_name: row.day_name.trim(),
      transaction_count: parseInt(String(row.count), 10),
      total_amount: formatAmount(row.total),
    })),
    peak_hours: hourDist.map((row) => ({
      hour: row.hour,
      transaction_count: parseInt(String(row.count), 10),
      total_amount: formatAmount(row.total),
    })),
  };
}

export async function analyzeBudgetReport(params: { userId: string; yearMonth?: string }) {
  const { userId, yearMonth = getCurrentYearMonth() } = params;

  const budgetData = await db
    .select({
      categoryId: budgets.categoryId,
      amount: budgets.amount,
      alertThreshold: budgets.alertThreshold,
      categoryName: categories.name,
    })
    .from(budgets)
    .innerJoin(categories, eq(categories.id, budgets.categoryId))
    .where(and(eq(budgets.userId, userId), eq(budgets.yearMonth, yearMonth)));

  const results = [];
  let totalBudget = 0;
  let totalSpent = 0;

  for (const budget of budgetData) {
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
    const usedPct = budgetAmount > 0 ? Math.round((spent / budgetAmount) * 100) : 0;

    totalBudget += budgetAmount;
    totalSpent += spent;

    results.push({
      category_name: budget.categoryName,
      budget: budgetAmount,
      spent,
      remaining: parseFloat((budgetAmount - spent).toFixed(2)),
      used_percent: usedPct,
      status: usedPct > 100 ? 'exceeded' : usedPct >= budget.alertThreshold ? 'warning' : 'normal',
    });
  }

  const overBudgetCategories = results.filter((r) => r.status === 'exceeded');
  const nearLimitCategories = results.filter((r) => r.status === 'warning');

  return {
    year_month: yearMonth,
    total_budget: parseFloat(totalBudget.toFixed(2)),
    total_spent: parseFloat(totalSpent.toFixed(2)),
    total_remaining: parseFloat((totalBudget - totalSpent).toFixed(2)),
    overall_used_percent: totalBudget > 0 ? Math.round((totalSpent / totalBudget) * 100) : 0,
    categories: results,
    summary: {
      over_budget_count: overBudgetCategories.length,
      near_limit_count: nearLimitCategories.length,
      over_budget_categories: overBudgetCategories.map((c) => c.category_name),
    },
  };
}
