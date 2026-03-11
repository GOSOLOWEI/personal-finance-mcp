import { z } from 'zod';
import { adjustAccountBalance } from '../../services/accounts.service.js';
import { getDefaultUserId } from '../../utils/user.js';
import { handleError } from '../../utils/errors.js';

export const adjustAccountBalanceSchema = z.object({
  account_id: z.string().uuid().describe('账户 UUID'),
  actual_balance: z.number().describe('实际余额（与银行账单对账后的正确余额）'),
  note: z.string().max(200).optional().describe('校正原因说明'),
});

export type AdjustAccountBalanceInput = z.infer<typeof adjustAccountBalanceSchema>;

export async function adjustAccountBalanceTool(input: AdjustAccountBalanceInput) {
  try {
    const userId = await getDefaultUserId();
    const result = await adjustAccountBalance({
      userId,
      accountId: input.account_id,
      actualBalance: input.actual_balance,
      note: input.note,
    });

    const diffText =
      result.difference > 0
        ? `增加 ${result.difference.toFixed(2)} 元`
        : `减少 ${Math.abs(result.difference).toFixed(2)} 元`;

    return {
      success: true,
      message: `账户余额已校正至 ${input.actual_balance.toFixed(2)} 元（${diffText}）`,
    };
  } catch (err) {
    return handleError(err);
  }
}
