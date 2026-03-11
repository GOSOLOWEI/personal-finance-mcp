import { z } from 'zod';
import { createAccount } from '../../services/accounts.service.js';
import { getDefaultUserId } from '../../utils/user.js';
import { handleError } from '../../utils/errors.js';

export const recordAccountSchema = z.object({
  name: z.string().min(1).max(50).describe('账户名称，最长 50 字符'),
  type: z
    .enum(['checking', 'savings', 'alipay', 'wechat', 'credit_card', 'investment', 'cash', 'other'])
    .describe('账户类型'),
  initial_balance: z.number().min(0).default(0).describe('初始余额，默认 0'),
  currency: z.string().max(10).default('CNY').describe('货币代码，默认 CNY'),
  note: z.string().max(200).optional().describe('备注，最长 200 字符'),
});

export type RecordAccountInput = z.infer<typeof recordAccountSchema>;

export async function recordAccountTool(input: RecordAccountInput) {
  try {
    const userId = await getDefaultUserId();
    const accountId = await createAccount({
      userId,
      name: input.name,
      type: input.type,
      initialBalance: input.initial_balance,
      currency: input.currency,
      note: input.note,
    });

    return {
      success: true,
      account_id: accountId,
      message: `账户「${input.name}」已创建，初始余额 ${input.initial_balance.toFixed(2)} 元`,
    };
  } catch (err) {
    return handleError(err);
  }
}
