import { z } from 'zod';
import { listAuditLogs, restoreDeletedRecord } from '../../services/audit.service.js';
import { getDefaultUserId } from '../../utils/user.js';
import { handleError } from '../../utils/errors.js';

// ─── list_audit_logs ─────────────────────────────────────────────────────────
export const listAuditLogsSchema = z.object({
  resource_id: z.string().uuid().optional().describe('指定资源 ID：返回该记录的全部变更历史（含修改前后字段对比）'),
  resource_type: z
    .enum(['transaction', 'account', 'category', 'budget', 'subscription', 'amortization'])
    .optional(),
  start_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  end_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  action: z.enum(['create', 'update', 'delete', 'restore']).optional(),
  page: z.number().int().min(1).default(1),
  page_size: z.number().int().min(1).max(100).default(20),
});

export async function listAuditLogsTool(input: z.infer<typeof listAuditLogsSchema>) {
  try {
    const userId = await getDefaultUserId();
    const result = await listAuditLogs({
      userId,
      resourceId: input.resource_id,
      resourceType: input.resource_type,
      startDate: input.start_date,
      endDate: input.end_date,
      action: input.action,
      page: input.page,
      pageSize: input.page_size,
    });
    return { success: true, ...result };
  } catch (err) {
    return handleError(err);
  }
}

// ─── restore_deleted_record ──────────────────────────────────────────────────
export const restoreDeletedRecordSchema = z.object({
  resource_type: z
    .enum(['transaction', 'account', 'category', 'subscription', 'amortization'])
    .describe('资源类型'),
  resource_id: z.string().uuid().describe('资源 UUID'),
});

export async function restoreDeletedRecordTool(input: z.infer<typeof restoreDeletedRecordSchema>) {
  try {
    const userId = await getDefaultUserId();
    await restoreDeletedRecord({
      userId,
      resourceType: input.resource_type,
      resourceId: input.resource_id,
    });
    return {
      success: true,
      message: `${input.resource_type} ${input.resource_id} 已恢复`,
    };
  } catch (err) {
    return handleError(err);
  }
}
