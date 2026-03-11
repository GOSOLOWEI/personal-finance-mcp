import { z } from 'zod';
import { deleteAccount } from '../../services/accounts.service.js';
import { getDefaultUserId } from '../../utils/user.js';
import { handleError } from '../../utils/errors.js';

export const deleteAccountSchema = z.object({
  account_id: z.string().uuid().describe('账户 UUID'),
  force: z.boolean().default(false).describe('强制删除（同时软删除关联交易），默认 false'),
});

export type DeleteAccountInput = z.infer<typeof deleteAccountSchema>;

export async function deleteAccountTool(input: DeleteAccountInput) {
  try {
    const userId = await getDefaultUserId();
    await deleteAccount(input.account_id, userId, input.force);

    return {
      success: true,
      message: `账户 ${input.account_id} 已删除`,
    };
  } catch (err) {
    return handleError(err);
  }
}
