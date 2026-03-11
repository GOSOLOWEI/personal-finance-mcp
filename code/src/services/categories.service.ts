import { db } from '../db/client.js';
import { categories, transactions } from '../db/schema.js';
import { eq, and, isNull, sql } from 'drizzle-orm';
import { FinanceError } from '../utils/errors.js';
import { writeAuditLog } from '../utils/audit.js';

export interface CategoryNode {
  category_id: string;
  name: string;
  type: string;
  parent_id: string | null;
  group_label: string | null;
  icon: string | null;
  color: string | null;
  is_preset: boolean;
  is_hidden: boolean;
  count_in_stats: boolean;
  sort_order: number;
  children?: CategoryNode[];
}

export async function listCategories(params: {
  userId: string;
  type?: 'income' | 'expense' | 'all';
  includeHidden?: boolean;
}): Promise<CategoryNode[]> {
  const { userId, type = 'all', includeHidden = false } = params;

  const conditions = [eq(categories.userId, userId), isNull(categories.deletedAt)];
  if (type !== 'all') conditions.push(eq(categories.type, type));
  if (!includeHidden) conditions.push(eq(categories.isHidden, false));

  const allCategories = await db
    .select()
    .from(categories)
    .where(and(...conditions))
    .orderBy(categories.sortOrder);

  // 构建两级树形结构
  const parentMap = new Map<string, CategoryNode>();
  const roots: CategoryNode[] = [];

  // 先处理一级分类
  for (const cat of allCategories) {
    if (!cat.parentId) {
      const node: CategoryNode = {
        category_id: cat.id,
        name: cat.name,
        type: cat.type,
        parent_id: null,
        group_label: cat.groupLabel,
        icon: cat.icon,
        color: cat.color,
        is_preset: cat.isPreset,
        is_hidden: cat.isHidden,
        count_in_stats: cat.countInStats,
        sort_order: cat.sortOrder,
        children: [],
      };
      parentMap.set(cat.id, node);
      roots.push(node);
    }
  }

  // 再处理二级分类
  for (const cat of allCategories) {
    if (cat.parentId) {
      const parent = parentMap.get(cat.parentId);
      if (parent) {
        parent.children!.push({
          category_id: cat.id,
          name: cat.name,
          type: cat.type,
          parent_id: cat.parentId,
          group_label: cat.groupLabel,
          icon: cat.icon,
          color: cat.color,
          is_preset: cat.isPreset,
          is_hidden: cat.isHidden,
          count_in_stats: cat.countInStats,
          sort_order: cat.sortOrder,
        });
      }
    }
  }

  return roots;
}

export async function createCategory(params: {
  userId: string;
  name: string;
  type: 'income' | 'expense';
  parentId?: string;
  icon?: string;
  color?: string;
}): Promise<string> {
  const { userId, name, type, parentId, icon, color } = params;

  // 校验不超过 2 级
  if (parentId) {
    const [parent] = await db
      .select()
      .from(categories)
      .where(and(eq(categories.id, parentId), isNull(categories.deletedAt)))
      .limit(1);

    if (!parent) {
      throw new FinanceError('NOT_FOUND', `父分类 ${parentId} 不存在`);
    }

    if (parent.parentId) {
      throw new FinanceError('CATEGORY_DEPTH_EXCEEDED', '分类最多支持 2 级，不能在二级分类下创建子分类');
    }
  }

  const [cat] = await db
    .insert(categories)
    .values({
      userId,
      name,
      type,
      parentId: parentId ?? null,
      icon: icon ?? null,
      color: color ?? null,
      isPreset: false,
    })
    .returning({ id: categories.id });

  await writeAuditLog({
    userId,
    action: 'create',
    resourceType: 'category',
    resourceId: cat.id,
    changes: { after: params },
    toolName: 'record_category',
  });

  return cat.id;
}

export async function updateCategory(
  categoryId: string,
  userId: string,
  params: {
    name?: string;
    icon?: string;
    color?: string;
    hidden?: boolean;
  }
): Promise<void> {
  const [existing] = await db
    .select()
    .from(categories)
    .where(and(eq(categories.id, categoryId), eq(categories.userId, userId)))
    .limit(1);

  if (!existing) {
    throw new FinanceError('NOT_FOUND', `分类 ${categoryId} 不存在`);
  }

  const updateData: Record<string, unknown> = { updatedAt: new Date() };
  if (params.name !== undefined) updateData.name = params.name;
  if (params.icon !== undefined) updateData.icon = params.icon;
  if (params.color !== undefined) updateData.color = params.color;
  if (params.hidden !== undefined) updateData.isHidden = params.hidden;

  await db.update(categories).set(updateData as Partial<typeof categories.$inferInsert>).where(eq(categories.id, categoryId));

  await writeAuditLog({
    userId,
    action: 'update',
    resourceType: 'category',
    resourceId: categoryId,
    changes: { before: existing, after: params },
    toolName: 'update_category',
  });
}

export async function deleteCategory(
  categoryId: string,
  userId: string,
  replaceCategoryId?: string
): Promise<void> {
  const [existing] = await db
    .select()
    .from(categories)
    .where(and(eq(categories.id, categoryId), eq(categories.userId, userId)))
    .limit(1);

  if (!existing) {
    throw new FinanceError('NOT_FOUND', `分类 ${categoryId} 不存在`);
  }

  if (existing.isPreset) {
    throw new FinanceError('PRESET_CATEGORY_DELETE', '预设分类不可删除，如需隐藏请使用 update_category 设置 hidden=true');
  }

  // 检查是否有关联交易
  const [txCount] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(transactions)
    .where(and(eq(transactions.categoryId, categoryId), isNull(transactions.deletedAt)));

  if ((txCount?.count ?? 0) > 0) {
    if (!replaceCategoryId) {
      throw new FinanceError(
        'ACCOUNT_HAS_TRANSACTIONS',
        `该分类下有 ${txCount.count} 条交易记录，请提供 replace_category_id 将交易迁移到其他分类`
      );
    }
    // 迁移交易到替换分类
    await db
      .update(transactions)
      .set({ categoryId: replaceCategoryId })
      .where(and(eq(transactions.categoryId, categoryId), isNull(transactions.deletedAt)));
  }

  await db
    .update(categories)
    .set({ deletedAt: new Date() })
    .where(eq(categories.id, categoryId));

  await writeAuditLog({
    userId,
    action: 'delete',
    resourceType: 'category',
    resourceId: categoryId,
    toolName: 'delete_category',
  });
}
