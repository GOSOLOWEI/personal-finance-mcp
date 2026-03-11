import { z } from 'zod';
import { recordTransaction } from '../../services/transactions.service.js';
import { getDefaultUserId } from '../../utils/user.js';
import { handleError } from '../../utils/errors.js';

const tagLabelsSchema = z.object({
  method: z.enum(['线上', '线下', '外卖']).optional(),
  behavior: z.enum(['日常消费', '冲动消费']).optional(),
  consumption_type: z.enum(['必选消费', '可选消费']).optional(),
  scale: z.enum(['大额支出', '小额支出']).optional(),
  purpose: z.enum(['生存必需', '发展提升', '享受休闲']).optional(),
});

export const recordTransactionSchema = z.object({
  type: z.enum(['income', 'expense', 'transfer']).describe('交易类型'),
  amount: z
    .number()
    .positive()
    .max(999999999)
    .refine((v) => parseFloat(v.toFixed(2)) === v || true)
    .describe('金额，正数，最多 2 位小数'),
  category_id: z.string().uuid().optional().describe('分类 UUID（transfer 类型可不填）'),
  account_id: z.string().uuid().describe('来源账户 UUID'),
  to_account_id: z.string().uuid().optional().describe('目标账户（仅 transfer 类型需要）'),
  occurred_at: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/)
    .optional()
    .describe('交易时间，格式 "YYYY-MM-DD HH:mm:ss"，默认当前时间'),
  note: z.string().max(500).optional().describe('备注说明，最长 500 字符'),
  tag_labels: tagLabelsSchema.optional().describe('结构化标签，每个维度 0 或 1 个值（仅 expense 有意义）'),
});

export type RecordTransactionInput = z.infer<typeof recordTransactionSchema>;

export async function recordTransactionTool(input: RecordTransactionInput) {
  try {
    const userId = await getDefaultUserId();
    const result = await recordTransaction({
      userId,
      type: input.type,
      amount: parseFloat(input.amount.toFixed(2)),
      categoryId: input.category_id,
      accountId: input.account_id,
      toAccountId: input.to_account_id,
      occurredAt: input.occurred_at,
      note: input.note,
      tagLabels: input.tag_labels,
    });

    return {
      success: true,
      transaction_id: result.transaction_id,
      message: result.message,
      ...(result.budget_warning && { budget_warning: result.budget_warning }),
      ...(result.suggested_tag_labels && { suggested_tag_labels: result.suggested_tag_labels }),
    };
  } catch (err) {
    return handleError(err);
  }
}
