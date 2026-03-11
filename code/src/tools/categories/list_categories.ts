import { z } from 'zod';
import { listCategories } from '../../services/categories.service.js';
import { getDefaultUserId } from '../../utils/user.js';
import { handleError } from '../../utils/errors.js';

export const listCategoriesSchema = z.object({
  type: z.enum(['income', 'expense', 'all']).default('all').describe('分类类型过滤'),
  include_hidden: z.boolean().default(false).describe('是否包含隐藏分类，默认 false'),
});

export type ListCategoriesInput = z.infer<typeof listCategoriesSchema>;

export async function listCategoriesTool(input: ListCategoriesInput) {
  try {
    const userId = await getDefaultUserId();
    const result = await listCategories({
      userId,
      type: input.type,
      includeHidden: input.include_hidden,
    });

    return {
      success: true,
      categories: result,
      total: result.length,
    };
  } catch (err) {
    return handleError(err);
  }
}
