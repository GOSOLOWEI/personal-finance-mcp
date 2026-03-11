import { z } from 'zod';
import { updateAmortization } from '../../services/amortizations.service.js';
import { getDefaultUserId } from '../../utils/user.js';
import { handleError } from '../../utils/errors.js';

export const updateAmortizationSchema = z.object({
  amortization_id: z.string().uuid().describe('分摊计划 UUID'),
  total_months: z.number().int().min(2).optional().describe('修改总摊销月数（不能少于已摊销月数）'),
  status: z.enum(['active', 'cancelled']).optional(),
  note: z.string().max(500).optional(),
});

export type UpdateAmortizationInput = z.infer<typeof updateAmortizationSchema>;

export async function updateAmortizationTool(input: UpdateAmortizationInput) {
  try {
    const userId = await getDefaultUserId();
    await updateAmortization(input.amortization_id, userId, {
      totalMonths: input.total_months,
      status: input.status,
      note: input.note,
    });

    const statusText = input.status === 'cancelled' ? '已取消' : '已更新';
    return {
      success: true,
      message: `分摊计划 ${input.amortization_id} ${statusText}`,
    };
  } catch (err) {
    return handleError(err);
  }
}
