import { z } from 'zod';
import { listTags } from '../../services/tags.service.js';
import { getDefaultUserId } from '../../utils/user.js';
import { handleError } from '../../utils/errors.js';

export const listTagsSchema = z.object({});

export type ListTagsInput = z.infer<typeof listTagsSchema>;

export async function listTagsTool(_input: ListTagsInput) {
  try {
    const userId = await getDefaultUserId();
    const result = await listTags(userId);

    return {
      success: true,
      ...result,
    };
  } catch (err) {
    return handleError(err);
  }
}
