import { db } from '../db/client.js';
import { users } from '../db/schema.js';

let cachedUserId: string | null = null;

/**
 * 获取默认用户 ID（单用户模式）
 * 生产环境中需替换为多用户认证逻辑
 */
export async function getDefaultUserId(): Promise<string> {
  if (cachedUserId) return cachedUserId;

  const [user] = await db.select({ id: users.id }).from(users).limit(1);
  if (!user) {
    throw new Error('No default user found. Please run: npm run db:seed');
  }

  cachedUserId = user.id;
  return cachedUserId;
}
