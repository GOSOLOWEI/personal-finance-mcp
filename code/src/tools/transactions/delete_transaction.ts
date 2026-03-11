import { z } from 'zod';
import { deleteTransaction } from '../../services/transactions.service.js';
import { getDefaultUserId } from '../../utils/user.js';
import { handleError } from '../../utils/errors.js';

export const deleteTransactionSchema = z.object({
  transaction_id: z.string().uuid().describe('交易 UUID'),
  reason: z.string().max(200).optional().describe('删除原因，用于审计日志'),
});

export type DeleteTransactionInput = z.infer<typeof deleteTransactionSchema>;

export async function deleteTransactionTool(input: DeleteTransactionInput) {
  try {
    const userId = await getDefaultUserId();
    await deleteTransaction(input.transaction_id, userId, input.reason);

    return {
      success: true,
      message: `交易记录 ${input.transaction_id} 已删除`,
    };
  } catch (err) {
    return handleError(err);
  }
}
