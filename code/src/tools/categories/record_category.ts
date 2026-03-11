import { z } from 'zod';
import { createCategory } from '../../services/categories.service.js';
import { getDefaultUserId } from '../../utils/user.js';
import { handleError } from '../../utils/errors.js';

export const recordCategorySchema = z.object({
  name: z.string().min(1).max(30).describe('分类名，最长 30 字符'),
  type: z.enum(['income', 'expense']).describe('分类类型'),
  parent_id: z.string().uuid().optional().describe('父分类 UUID（创建二级子分类时必填；不传则创建一级分类）'),
  icon: z.string().max(10).optional().describe('emoji 图标字符'),
  color: z.string().regex(/^#[0-9A-Fa-f]{6}$/).optional().describe('HEX 颜色，如 #FF5733'),
});

export type RecordCategoryInput = z.infer<typeof recordCategorySchema>;

export async function recordCategoryTool(input: RecordCategoryInput) {
  try {
    const userId = await getDefaultUserId();
    const categoryId = await createCategory({
      userId,
      name: input.name,
      type: input.type,
      parentId: input.parent_id,
      icon: input.icon,
      color: input.color,
    });

    return {
      success: true,
      category_id: categoryId,
      message: `分类「${input.name}」已创建`,
    };
  } catch (err) {
    return handleError(err);
  }
}
