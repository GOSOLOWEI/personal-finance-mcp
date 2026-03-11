import { z } from 'zod';
import { updateTransaction, type TagLabels } from '../../services/transactions.service.js';
import { getDefaultUserId } from '../../utils/user.js';
import { handleError } from '../../utils/errors.js';

export const updateTransactionSchema = z.object({
  transaction_id: z.string().uuid().describe('交易 UUID'),
  amount: z.coerce.number().positive().max(999999999).optional(),
  category_id: z.string().uuid().optional(),
  account_id: z.string().uuid().optional(),
  occurred_at: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/)
    .optional()
    .describe('格式 "YYYY-MM-DD HH:mm:ss"'),
  note: z.string().max(500).optional(),
  tag_labels: z
    .object({
      method: z.string().nullable().optional(),
      behavior: z.string().nullable().optional(),
      consumption_type: z.string().nullable().optional(),
      scale: z.string().nullable().optional(),
      purpose: z.string().nullable().optional(),
    })
    .optional()
    .describe('手动修正标签时使用，传入则整体覆盖，null 值表示清除该维度。通常只需修正 method/behavior，其余字段由系统自动维护'),
});

export type UpdateTransactionInput = z.infer<typeof updateTransactionSchema>;

export async function updateTransactionTool(input: UpdateTransactionInput) {
  try {
    const userId = await getDefaultUserId();
    await updateTransaction(input.transaction_id, userId, {
      amount: input.amount,
      categoryId: input.category_id,
      accountId: input.account_id,
      occurredAt: input.occurred_at,
      note: input.note,
      tagLabels: input.tag_labels as Partial<TagLabels> | null | undefined,
    });

    return {
      success: true,
      message: `交易记录 ${input.transaction_id} 已更新`,
    };
  } catch (err) {
    return handleError(err);
  }
}
