import { z } from 'zod';
import { createSubscription } from '../../services/subscriptions.service.js';
import { getDefaultUserId } from '../../utils/user.js';
import { handleError } from '../../utils/errors.js';

export const recordSubscriptionSchema = z.object({
  name: z.string().min(1).max(100).describe('订阅名称，如「Netflix」「ChatGPT Plus」'),
  amount: z.coerce.number().positive().describe('每期扣费金额'),
  cycle: z.enum(['monthly', 'quarterly', 'yearly', 'weekly']).describe('扣费周期'),
  account_id: z.string().uuid().describe('扣费账户 UUID'),
  category_id: z.string().uuid().optional().describe('关联分类（如「通讯/软件订阅」）'),
  next_billing_date: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .describe('下次扣费日期 "YYYY-MM-DD"'),
  auto_renew: z.boolean().default(true).describe('是否自动续费，默认 true'),
  note: z.string().max(500).optional(),
});

export type RecordSubscriptionInput = z.infer<typeof recordSubscriptionSchema>;

export async function recordSubscriptionTool(input: RecordSubscriptionInput) {
  try {
    const userId = await getDefaultUserId();
    const subscriptionId = await createSubscription({
      userId,
      name: input.name,
      amount: input.amount,
      cycle: input.cycle,
      accountId: input.account_id,
      categoryId: input.category_id,
      nextBillingDate: input.next_billing_date,
      autoRenew: input.auto_renew,
      note: input.note,
    });

    const cycleText: Record<string, string> = {
      monthly: '月',
      quarterly: '季',
      yearly: '年',
      weekly: '周',
    };

    return {
      success: true,
      subscription_id: subscriptionId,
      message: `已记录订阅「${input.name}」，每${cycleText[input.cycle] ?? input.cycle} ${input.amount.toFixed(2)} 元，下次扣费：${input.next_billing_date}`,
    };
  } catch (err) {
    return handleError(err);
  }
}
