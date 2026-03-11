import { db } from '../db/client.js';
import { auditLogs } from '../db/schema.js';

export interface AuditParams {
  userId: string;
  action: 'create' | 'update' | 'delete' | 'restore';
  resourceType: string;
  resourceId: string;
  changes?: { before?: unknown; after?: unknown };
  toolName?: string;
}

export async function writeAuditLog(params: AuditParams): Promise<void> {
  await db.insert(auditLogs).values({
    userId: params.userId,
    action: params.action,
    resourceType: params.resourceType,
    resourceId: params.resourceId,
    changes: params.changes ?? null,
    toolName: params.toolName ?? null,
  });
}
