import { z } from 'zod';
import { createAmortization } from '../../services/amortizations.service.js';
import { getDefaultUserId } from '../../utils/user.js';
import { handleError } from '../../utils/errors.js';

export const recordAmortizationSchema = z.object({
  transaction_id: z.string().uuid().describe('要分摊的交易 UUID（该交易 type 必须为 expense）'),
  start_month: z.string().regex(/^\d{4}-\d{2}$/).describe('分摊起始月，格式 "2026-03"'),
  total_months: z.number().int().min(2).describe('总摊销月数，最少 2 个月'),
  note: z.string().max(500).optional(),
});

export type RecordAmortizationInput = z.infer<typeof recordAmortizationSchema>;

export async function recordAmortizationTool(input: RecordAmortizationInput) {
  try {
    const userId = await getDefaultUserId();
    const result = await createAmortization({
      userId,
      transactionId: input.transaction_id,
      startMonth: input.start_month,
      totalMonths: input.total_months,
      note: input.note,
    });

    return {
      success: true,
      amortization_id: result.amortization_id,
      monthly_amount: result.monthly_amount,
      schedule: result.schedule,
      message: `已创建 ${input.total_months} 个月分摊计划，每月 ${result.monthly_amount.toFixed(2)} 元`,
    };
  } catch (err) {
    return handleError(err);
  }
}
