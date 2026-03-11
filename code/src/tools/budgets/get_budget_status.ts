import { z } from 'zod';
import { getBudgetStatus } from '../../services/budgets.service.js';
import { getDefaultUserId } from '../../utils/user.js';
import { handleError } from '../../utils/errors.js';

export const getBudgetStatusSchema = z.object({
  year_month: z
    .string()
    .regex(/^\d{4}-\d{2}$/)
    .optional()
    .describe('格式 "2026-03"，默认当月'),
});

export type GetBudgetStatusInput = z.infer<typeof getBudgetStatusSchema>;

export async function getBudgetStatusTool(input: GetBudgetStatusInput) {
  try {
    const userId = await getDefaultUserId();
    const result = await getBudgetStatus({
      userId,
      yearMonth: input.year_month,
    });

    return {
      success: true,
      ...result,
    };
  } catch (err) {
    return handleError(err);
  }
}
