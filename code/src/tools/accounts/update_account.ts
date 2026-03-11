import { z } from 'zod';
import { updateAccount } from '../../services/accounts.service.js';
import { getDefaultUserId } from '../../utils/user.js';
import { handleError } from '../../utils/errors.js';

export const updateAccountSchema = z.object({
  account_id: z.string().uuid().describe('账户 UUID'),
  name: z.string().min(1).max(50).optional().describe('新账户名称'),
  note: z.string().max(200).optional().nullable().describe('备注'),
});

export type UpdateAccountInput = z.infer<typeof updateAccountSchema>;

export async function updateAccountTool(input: UpdateAccountInput) {
  try {
    const userId = await getDefaultUserId();
    await updateAccount(input.account_id, userId, {
      name: input.name,
      note: input.note === null ? '' : input.note,
    });

    return {
      success: true,
      message: `账户 ${input.account_id} 已更新`,
    };
  } catch (err) {
    return handleError(err);
  }
}
