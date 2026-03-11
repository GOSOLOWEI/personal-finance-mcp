import { z } from 'zod';
import { recordTransaction, inferSuggestedTags } from '../../services/transactions.service.js';
import { getDefaultUserId } from '../../utils/user.js';
import { handleError } from '../../utils/errors.js';
import { normalizeOccurredAt } from '../../utils/response.js';

const transactionItemSchema = z.object({
  type: z.enum(['income', 'expense', 'transfer']),
  amount: z.coerce.number().positive().max(999999999),
  category_id: z.string().uuid().optional(),
  account_id: z.string().uuid().optional(),
  occurred_at: z
    .string()
    .regex(
      /^\d{4}-\d{2}-\d{2}( \d{2}:\d{2}(:\d{2})?)?$/,
      '时间格式错误，支持：YYYY-MM-DD 或 YYYY-MM-DD HH:mm 或 YYYY-MM-DD HH:mm:ss'
    )
    .optional(),
  note: z.string().max(500).optional(),
  tag_labels: z
    .object({
      method: z.enum(['线上', '线下', '外卖']).optional()
        .describe('有明确信号时填写，否则留空'),
      behavior: z.enum(['日常消费', '冲动消费']).optional()
        .describe('仅冲动消费时填写，日常消费留空'),
    })
    .optional()
    .describe('情境标签（仅 expense 类型）；scale/consumption_type/purpose 由服务端自动计算，禁止传入'),
  source_text: z.string().optional().describe('对应的原始文本片段'),
});

export const batchRecordTransactionsSchema = z.object({
  raw_text: z.string().min(1).max(2000).describe('原始自然语言文本，最长 2000 字符'),
  account_id: z.string().uuid().describe('默认使用的账户 UUID'),
  default_date: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .optional()
    .describe('默认日期 "YYYY-MM-DD"，默认今天'),
  dry_run: z.boolean().default(false).describe('仅解析预览，不写入数据库，默认 false'),
  transactions: z
    .array(transactionItemSchema)
    .min(1)
    .max(50)
    .describe('AI 解析后的交易列表（由 AI 客户端预先解析传入）'),
});

export type BatchRecordTransactionsInput = z.infer<typeof batchRecordTransactionsSchema>;

export async function batchRecordTransactionsTool(input: BatchRecordTransactionsInput) {
  try {
    const userId = await getDefaultUserId();
    const defaultDate = input.default_date ?? new Date().toISOString().split('T')[0];

    const results = [];
    const budgetWarnings = [];

    for (const tx of input.transactions) {
      const accountId = tx.account_id ?? input.account_id;
      const occurredAt = normalizeOccurredAt(tx.occurred_at) ?? `${defaultDate} 12:00:00`;

      if (input.dry_run) {
        // 仅预览，返回解析结果
        const suggestedTags = tx.type === 'expense'
          ? inferSuggestedTags({ amount: tx.amount })
          : undefined;

        results.push({
          transaction_id: null,
          type: tx.type,
          amount: tx.amount,
          account_id: accountId,
          occurred_at: occurredAt,
          note: tx.note ?? '',
          tag_labels: tx.tag_labels ?? suggestedTags ?? {},
          source_text: tx.source_text ?? input.raw_text,
        });
      } else {
        const result = await recordTransaction({
          userId,
          type: tx.type,
          amount: parseFloat(tx.amount.toFixed(2)),
          categoryId: tx.category_id,
          accountId,
          occurredAt,
          note: tx.note,
          tagLabels: tx.tag_labels,
          sourceText: tx.source_text ?? input.raw_text,
        });

        results.push({
          transaction_id: result.transaction_id,
          type: tx.type,
          amount: tx.amount,
          account_id: accountId,
          occurred_at: occurredAt,
          note: tx.note ?? '',
          tag_labels: tx.tag_labels ?? result.suggested_tag_labels ?? {},
          source_text: tx.source_text ?? input.raw_text,
        });

        if (result.budget_warning) {
          budgetWarnings.push(result.budget_warning);
        }
      }
    }

    return {
      success: true,
      parsed_count: results.length,
      transactions: results,
      ...(budgetWarnings.length > 0 && { budget_warnings: budgetWarnings }),
    };
  } catch (err) {
    return handleError(err);
  }
}
