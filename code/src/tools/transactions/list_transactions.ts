import { z } from 'zod';
import { listTransactions } from '../../services/transactions.service.js';
import { getDefaultUserId } from '../../utils/user.js';
import { handleError } from '../../utils/errors.js';

export const listTransactionsSchema = z.object({
  transaction_id: z.string().uuid().optional().describe('指定单条 ID 查询（与其他过滤条件互斥）'),
  include_history: z.boolean().default(false).describe('单条查询时：是否返回修改历史，默认 false'),
  start_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional().describe('开始日期 "YYYY-MM-DD"'),
  end_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional().describe('结束日期 "YYYY-MM-DD"'),
  type: z.enum(['income', 'expense', 'transfer', 'all']).default('all').describe('交易类型过滤'),
  category_id: z.string().uuid().optional(),
  account_id: z.string().uuid().optional(),
  min_amount: z.number().positive().optional(),
  max_amount: z.number().positive().optional(),
  keyword: z.string().max(100).optional().describe('备注关键词搜索'),
  tag_filter: z
    .object({
      method: z.string().optional(),
      behavior: z.string().optional(),
      consumption_type: z.string().optional(),
      scale: z.string().optional(),
      purpose: z.string().optional(),
    })
    .optional()
    .describe('按标签维度过滤（各维度间 AND 逻辑）'),
  page: z.number().int().min(1).default(1),
  page_size: z.number().int().min(1).max(200).default(50),
  order: z
    .enum(['date_desc', 'date_asc', 'amount_desc', 'amount_asc'])
    .default('date_desc')
    .describe('排序方式，默认按日期降序'),
});

export type ListTransactionsInput = z.infer<typeof listTransactionsSchema>;

export async function listTransactionsTool(input: ListTransactionsInput) {
  try {
    const userId = await getDefaultUserId();
    const result = await listTransactions({
      userId,
      transactionId: input.transaction_id,
      includeHistory: input.include_history,
      startDate: input.start_date,
      endDate: input.end_date,
      type: input.type,
      categoryId: input.category_id,
      accountId: input.account_id,
      minAmount: input.min_amount,
      maxAmount: input.max_amount,
      keyword: input.keyword,
      tagFilter: input.tag_filter,
      page: input.page,
      pageSize: input.page_size,
      order: input.order,
    });

    return {
      success: true,
      ...result,
    };
  } catch (err) {
    return handleError(err);
  }
}
