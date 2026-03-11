import { z } from 'zod';
import { listSubscriptions } from '../../services/subscriptions.service.js';
import { getDefaultUserId } from '../../utils/user.js';
import { handleError } from '../../utils/errors.js';

export const listSubscriptionsSchema = z.object({
  status: z
    .enum(['active', 'cancelled', 'paused', 'all'])
    .default('active')
    .describe('订阅状态过滤，默认 active'),
  upcoming_days: z
    .number()
    .int()
    .min(1)
    .max(90)
    .default(7)
    .describe('高亮展示 N 天内到期的订阅，默认 7'),
});

export type ListSubscriptionsInput = z.infer<typeof listSubscriptionsSchema>;

export async function listSubscriptionsTool(input: ListSubscriptionsInput) {
  try {
    const userId = await getDefaultUserId();
    const result = await listSubscriptions({
      userId,
      status: input.status,
      upcomingDays: input.upcoming_days,
    });

    return {
      success: true,
      ...result,
    };
  } catch (err) {
    return handleError(err);
  }
}
