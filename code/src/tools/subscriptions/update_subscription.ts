import { z } from 'zod';
import { updateSubscription } from '../../services/subscriptions.service.js';
import { getDefaultUserId } from '../../utils/user.js';
import { handleError } from '../../utils/errors.js';

export const updateSubscriptionSchema = z.object({
  subscription_id: z.string().uuid().describe('订阅 UUID'),
  name: z.string().min(1).max(100).optional(),
  amount: z.coerce.number().positive().optional(),
  cycle: z.enum(['monthly', 'quarterly', 'yearly', 'weekly']).optional(),
  account_id: z.string().uuid().optional(),
  category_id: z.string().uuid().optional(),
  next_billing_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  auto_renew: z.boolean().optional(),
  status: z.enum(['active', 'cancelled', 'paused']).optional(),
  note: z.string().max(500).optional(),
});

export type UpdateSubscriptionInput = z.infer<typeof updateSubscriptionSchema>;

export async function updateSubscriptionTool(input: UpdateSubscriptionInput) {
  try {
    const userId = await getDefaultUserId();
    await updateSubscription(input.subscription_id, userId, {
      name: input.name,
      amount: input.amount,
      cycle: input.cycle,
      accountId: input.account_id,
      categoryId: input.category_id,
      nextBillingDate: input.next_billing_date,
      autoRenew: input.auto_renew,
      status: input.status,
      note: input.note,
    });

    const statusText = input.status === 'cancelled' ? '已取消' : '已更新';
    return {
      success: true,
      message: `订阅 ${input.subscription_id} ${statusText}`,
    };
  } catch (err) {
    return handleError(err);
  }
}
