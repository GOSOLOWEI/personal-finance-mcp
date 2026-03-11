import { z } from 'zod';
import { recordNetWorthSnapshot, analyzeNetWorthTrend } from '../../services/net-worth.service.js';
import { getDefaultUserId } from '../../utils/user.js';
import { handleError } from '../../utils/errors.js';

// ─── record_net_worth_snapshot ───────────────────────────────────────────────
export const recordNetWorthSnapshotSchema = z.object({
  note: z.string().max(200).optional().describe('快照备注'),
});

export async function recordNetWorthSnapshotTool(input: z.infer<typeof recordNetWorthSnapshotSchema>) {
  try {
    const userId = await getDefaultUserId();
    const result = await recordNetWorthSnapshot({ userId, note: input.note });
    return {
      success: true,
      ...result,
      message: `净资产快照已记录：净资产 ${result.net_worth.toFixed(2)} 元`,
    };
  } catch (err) {
    return handleError(err);
  }
}

// ─── analyze_net_worth_trend ─────────────────────────────────────────────────
export const analyzeNetWorthTrendSchema = z.object({
  months: z.number().int().min(1).max(60).default(12).describe('最近 N 个月快照，默认 12'),
});

export async function analyzeNetWorthTrendTool(input: z.infer<typeof analyzeNetWorthTrendSchema>) {
  try {
    const userId = await getDefaultUserId();
    const result = await analyzeNetWorthTrend({ userId, months: input.months });
    return { success: true, ...result };
  } catch (err) {
    return handleError(err);
  }
}
