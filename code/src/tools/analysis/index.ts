import { z } from 'zod';
import {
  analyzeMonthlySummary,
  analyzeYearlySummary,
  analyzeCategoryTrend,
  analyzeTopExpenses,
  analyzeCashFlow,
  analyzeSpendingPattern,
  analyzeBudgetReport,
} from '../../services/analysis.service.js';
import { getDefaultUserId } from '../../utils/user.js';
import { handleError } from '../../utils/errors.js';

// ─── analyze_monthly_summary ────────────────────────────────────────────────
export const analyzeMonthlySummarySchema = z.object({
  year_month: z.string().regex(/^\d{4}-\d{2}$/).optional().describe('默认当月，格式 "2026-03"'),
  account_id: z.string().uuid().optional(),
  include_budget_comparison: z.boolean().default(false),
  include_amortized: z.boolean().default(true).describe('是否使用分摊后金额计算支出，默认 true'),
});

export async function analyzeMonthlySummaryTool(input: z.infer<typeof analyzeMonthlySummarySchema>) {
  try {
    const userId = await getDefaultUserId();
    const result = await analyzeMonthlySummary({
      userId,
      yearMonth: input.year_month,
      accountId: input.account_id,
      includeBudgetComparison: input.include_budget_comparison,
      includeAmortized: input.include_amortized,
    });
    return { success: true, ...result };
  } catch (err) {
    return handleError(err);
  }
}

// ─── analyze_yearly_summary ─────────────────────────────────────────────────
export const analyzeYearlySummarySchema = z.object({
  year: z.number().int().min(2000).max(2100).optional().describe('默认当年'),
});

export async function analyzeYearlySummaryTool(input: z.infer<typeof analyzeYearlySummarySchema>) {
  try {
    const userId = await getDefaultUserId();
    const result = await analyzeYearlySummary({ userId, year: input.year });
    return { success: true, ...result };
  } catch (err) {
    return handleError(err);
  }
}

// ─── analyze_category_trend ─────────────────────────────────────────────────
export const analyzeCategoryTrendSchema = z.object({
  category_id: z.string().uuid().describe('必填，分类 UUID'),
  months: z.number().int().min(1).max(24).default(6).describe('分析最近 N 个月，默认 6'),
});

export async function analyzeCategoryTrendTool(input: z.infer<typeof analyzeCategoryTrendSchema>) {
  try {
    const userId = await getDefaultUserId();
    const result = await analyzeCategoryTrend({ userId, categoryId: input.category_id, months: input.months });
    return { success: true, ...result };
  } catch (err) {
    return handleError(err);
  }
}

// ─── analyze_budget_report ───────────────────────────────────────────────────
export const analyzeBudgetReportSchema = z.object({
  year_month: z.string().regex(/^\d{4}-\d{2}$/).optional(),
});

export async function analyzeBudgetReportTool(input: z.infer<typeof analyzeBudgetReportSchema>) {
  try {
    const userId = await getDefaultUserId();
    const result = await analyzeBudgetReport({ userId, yearMonth: input.year_month });
    return { success: true, ...result };
  } catch (err) {
    return handleError(err);
  }
}

// ─── analyze_spending_pattern ───────────────────────────────────────────────
export const analyzeSpendingPatternSchema = z.object({
  start_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  end_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  category_id: z.string().uuid().optional(),
});

export async function analyzeSpendingPatternTool(input: z.infer<typeof analyzeSpendingPatternSchema>) {
  try {
    const userId = await getDefaultUserId();
    const result = await analyzeSpendingPattern({
      userId,
      startDate: input.start_date,
      endDate: input.end_date,
      categoryId: input.category_id,
    });
    return { success: true, ...result };
  } catch (err) {
    return handleError(err);
  }
}

// ─── analyze_top_expenses ────────────────────────────────────────────────────
export const analyzeTopExpensesSchema = z.object({
  start_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  end_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  top_n: z.number().int().min(1).max(50).default(10),
  category_id: z.string().uuid().optional(),
  account_id: z.string().uuid().optional(),
});

export async function analyzeTopExpensesTool(input: z.infer<typeof analyzeTopExpensesSchema>) {
  try {
    const userId = await getDefaultUserId();
    const result = await analyzeTopExpenses({
      userId,
      startDate: input.start_date,
      endDate: input.end_date,
      topN: input.top_n,
      categoryId: input.category_id,
      accountId: input.account_id,
    });
    return { success: true, ...result };
  } catch (err) {
    return handleError(err);
  }
}

// ─── analyze_cash_flow ───────────────────────────────────────────────────────
export const analyzeCashFlowSchema = z.object({
  period: z.enum(['daily', 'weekly', 'monthly']).default('monthly'),
  months: z.number().int().min(1).max(24).default(3),
  account_id: z.string().uuid().optional(),
});

export async function analyzeCashFlowTool(input: z.infer<typeof analyzeCashFlowSchema>) {
  try {
    const userId = await getDefaultUserId();
    const result = await analyzeCashFlow({
      userId,
      period: input.period,
      months: input.months,
      accountId: input.account_id,
    });
    return { success: true, ...result };
  } catch (err) {
    return handleError(err);
  }
}
