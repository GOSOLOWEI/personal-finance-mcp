import { db } from '../db/client.js';
import { tagDefinitions, transactions } from '../db/schema.js';
import { eq, sql } from 'drizzle-orm';

export async function listTags(userId: string) {
  const tagDefs = await db
    .select()
    .from(tagDefinitions)
    .orderBy(tagDefinitions.dimension, tagDefinitions.sortOrder);

  // 统计各标签使用次数
  const usageStats = await db.execute(sql`
    SELECT
      key,
      value,
      COUNT(*) AS usage_count,
      MAX(occurred_at) AS last_used_at
    FROM transactions,
    jsonb_each_text(tag_labels) AS kv(key, value)
    WHERE user_id = ${userId}
      AND deleted_at IS NULL
      AND tag_labels IS NOT NULL
    GROUP BY key, value
  `) as Array<{ key: string; value: string; usage_count: string; last_used_at: string }>;

  const usageMap = new Map<string, { count: number; lastUsed?: string }>();
  for (const row of usageStats) {
    usageMap.set(`${row.key}:${row.value}`, {
      count: parseInt(String(row.usage_count), 10),
      lastUsed: row.last_used_at,
    });
  }

  // 按维度分组
  const dimensionMap = new Map<string, {
    key: string;
    label: string;
    description: string;
    values: Array<{
      value: string;
      description: string;
      usage_count: number;
      last_used_at?: string;
    }>;
  }>();

  const dimensionDescriptions: Record<string, string> = {
    method: '记录消费发生的渠道方式，帮助分析线上线下消费比例',
    behavior: '反映消费的计划性，识别冲动消费模式',
    consumption_type: '区分刚性必要支出和弹性可选支出',
    scale: '按金额大小分类，识别大额支出触发点',
    purpose: '从消费目的角度审视支出结构',
  };

  for (const tag of tagDefs) {
    const key = tag.dimension;
    if (!dimensionMap.has(key)) {
      dimensionMap.set(key, {
        key,
        label: tag.dimensionLabel,
        description: dimensionDescriptions[key] ?? '',
        values: [],
      });
    }

    const usage = usageMap.get(`${key}:${tag.value}`);
    dimensionMap.get(key)!.values.push({
      value: tag.value,
      description: tag.description,
      usage_count: usage?.count ?? 0,
      last_used_at: usage?.lastUsed,
    });
  }

  return {
    dimensions: Array.from(dimensionMap.values()),
  };
}
