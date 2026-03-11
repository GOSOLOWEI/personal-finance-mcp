import { z } from 'zod';
import { setCategoryBudget } from '../../services/budgets.service.js';
import { getDefaultUserId } from '../../utils/user.js';
import { handleError } from '../../utils/errors.js';

export const setCategoryBudgetSchema = z.object({
  category_id: z.string().uuid().describe('分类 UUID'),
  amount: z.coerce.number().positive().describe('月度预算金额'),
  year_month: z
    .string()
    .regex(/^\d{4}-\d{2}$/)
    .optional()
    .describe('格式 "2026-03"，默认当月'),
  alert_threshold: z
    .coerce.number()
    .int()
    .min(1)
    .max(100)
    .default(80)
    .describe('预警阈值百分比 0-100，默认 80'),
  recurring: z.boolean().default(true).describe('是否每月自动延续，默认 true'),
});

export type SetCategoryBudgetInput = z.infer<typeof setCategoryBudgetSchema>;

export async function setCategoryBudgetTool(input: SetCategoryBudgetInput) {
  try {
    const userId = await getDefaultUserId();
    await setCategoryBudget({
      userId,
      categoryId: input.category_id,
      amount: input.amount,
      yearMonth: input.year_month,
      alertThreshold: input.alert_threshold,
      recurring: input.recurring,
    });

    const monthText = input.year_month ?? '当月';
    return {
      success: true,
      message: `已为分类设置 ${monthText} 预算 ${input.amount.toFixed(2)} 元`,
    };
  } catch (err) {
    return handleError(err);
  }
}
