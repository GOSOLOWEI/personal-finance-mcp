import { z } from 'zod';
import { listAccounts } from '../../services/accounts.service.js';
import { getDefaultUserId } from '../../utils/user.js';
import { handleError } from '../../utils/errors.js';

export const listAccountsSchema = z.object({
  include_deleted: z.boolean().default(false).describe('是否包含已删除账户，默认 false'),
  type: z
    .enum(['checking', 'savings', 'alipay', 'wechat', 'credit_card', 'investment', 'cash', 'other'])
    .optional()
    .describe('按账户类型过滤'),
});

export type ListAccountsInput = z.infer<typeof listAccountsSchema>;

export async function listAccountsTool(input: ListAccountsInput) {
  try {
    const userId = await getDefaultUserId();
    const result = await listAccounts({
      userId,
      includeDeleted: input.include_deleted,
      type: input.type,
    });

    return {
      success: true,
      ...result,
    };
  } catch (err) {
    return handleError(err);
  }
}
