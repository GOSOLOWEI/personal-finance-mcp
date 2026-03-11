import { z } from 'zod';
import { updateCategory } from '../../services/categories.service.js';
import { getDefaultUserId } from '../../utils/user.js';
import { handleError } from '../../utils/errors.js';

export const updateCategorySchema = z.object({
  category_id: z.string().uuid().describe('分类 UUID'),
  name: z.string().min(1).max(30).optional(),
  icon: z.string().max(10).optional(),
  color: z.string().regex(/^#[0-9A-Fa-f]{6}$/).optional(),
  hidden: z.boolean().optional().describe('true=隐藏，false=显示（仅预设分类需要此操作）'),
});

export type UpdateCategoryInput = z.infer<typeof updateCategorySchema>;

export async function updateCategoryTool(input: UpdateCategoryInput) {
  try {
    const userId = await getDefaultUserId();
    await updateCategory(input.category_id, userId, {
      name: input.name,
      icon: input.icon,
      color: input.color,
      hidden: input.hidden,
    });

    return {
      success: true,
      message: `分类 ${input.category_id} 已更新`,
    };
  } catch (err) {
    return handleError(err);
  }
}
