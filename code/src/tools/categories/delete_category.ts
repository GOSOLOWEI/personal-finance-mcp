import { z } from 'zod';
import { deleteCategory } from '../../services/categories.service.js';
import { getDefaultUserId } from '../../utils/user.js';
import { handleError } from '../../utils/errors.js';

export const deleteCategorySchema = z.object({
  category_id: z.string().uuid().describe('分类 UUID（仅可删除自建分类，预设分类只能隐藏）'),
  replace_category_id: z.string().uuid().optional().describe('该分类下的交易将迁移至此分类'),
});

export type DeleteCategoryInput = z.infer<typeof deleteCategorySchema>;

export async function deleteCategoryTool(input: DeleteCategoryInput) {
  try {
    const userId = await getDefaultUserId();
    await deleteCategory(input.category_id, userId, input.replace_category_id);

    return {
      success: true,
      message: `分类 ${input.category_id} 已删除`,
    };
  } catch (err) {
    return handleError(err);
  }
}
