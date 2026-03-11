import { z } from 'zod';
import { listAmortizations } from '../../services/amortizations.service.js';
import { getDefaultUserId } from '../../utils/user.js';
import { handleError } from '../../utils/errors.js';

export const listAmortizationsSchema = z.object({
  status: z
    .enum(['active', 'cancelled', 'completed', 'all'])
    .default('active')
    .describe('分摊计划状态过滤，默认 active'),
  year_month: z
    .string()
    .regex(/^\d{4}-\d{2}$/)
    .optional()
    .describe('查询指定月份有哪些分摊计划生效'),
});

export type ListAmortizationsInput = z.infer<typeof listAmortizationsSchema>;

export async function listAmortizationsTool(input: ListAmortizationsInput) {
  try {
    const userId = await getDefaultUserId();
    const result = await listAmortizations({
      userId,
      status: input.status,
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
