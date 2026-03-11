import { z } from 'zod';
import {
  createInvestmentAccount,
  recordInvestmentTransaction,
  listInvestmentHoldings,
  updateInvestmentValuation,
  analyzeInvestmentReturn,
} from '../../services/investments.service.js';
import { getDefaultUserId } from '../../utils/user.js';
import { handleError } from '../../utils/errors.js';

// ─── record_investment_account ───────────────────────────────────────────────
export const recordInvestmentAccountSchema = z.object({
  name: z.string().min(1).max(100).describe('如「富途牛牛」「支付宝基金」'),
  type: z.enum(['stock', 'fund', 'crypto', 'bond', 'other']),
  currency: z.string().max(10).default('CNY'),
  note: z.string().max(500).optional(),
});

export async function recordInvestmentAccountTool(input: z.infer<typeof recordInvestmentAccountSchema>) {
  try {
    const userId = await getDefaultUserId();
    const accountId = await createInvestmentAccount({ userId, ...input });
    return { success: true, account_id: accountId, message: `投资账户「${input.name}」已创建` };
  } catch (err) {
    return handleError(err);
  }
}

// ─── record_investment_transaction ──────────────────────────────────────────
export const recordInvestmentTransactionSchema = z.object({
  account_id: z.string().uuid(),
  type: z.enum(['buy', 'sell', 'dividend', 'fee']),
  asset_name: z.string().min(1).max(100),
  asset_code: z.string().max(20).optional(),
  quantity: z.coerce.number().positive().optional(),
  price: z.coerce.number().positive().optional(),
  amount: z.coerce.number().positive().describe('总金额（必填）'),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  note: z.string().max(500).optional(),
});

export async function recordInvestmentTransactionTool(input: z.infer<typeof recordInvestmentTransactionSchema>) {
  try {
    const userId = await getDefaultUserId();
    const txId = await recordInvestmentTransaction({
      userId,
      accountId: input.account_id,
      type: input.type,
      assetName: input.asset_name,
      assetCode: input.asset_code,
      quantity: input.quantity,
      price: input.price,
      amount: input.amount,
      date: input.date,
      note: input.note,
    });
    return { success: true, transaction_id: txId, message: `已记录 ${input.type} 交易：${input.asset_name} ${input.amount.toFixed(2)} 元` };
  } catch (err) {
    return handleError(err);
  }
}

// ─── list_investment_holdings ────────────────────────────────────────────────
export const listInvestmentHoldingsSchema = z.object({
  account_id: z.string().uuid().optional().describe('不填则查全部'),
});

export async function listInvestmentHoldingsTool(input: z.infer<typeof listInvestmentHoldingsSchema>) {
  try {
    const userId = await getDefaultUserId();
    const result = await listInvestmentHoldings({ userId, accountId: input.account_id });
    return { success: true, ...result };
  } catch (err) {
    return handleError(err);
  }
}

// ─── update_investment_valuation ─────────────────────────────────────────────
export const updateInvestmentValuationSchema = z.object({
  account_id: z.string().uuid(),
  current_value: z.coerce.number().min(0),
  valuation_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
});

export async function updateInvestmentValuationTool(input: z.infer<typeof updateInvestmentValuationSchema>) {
  try {
    const userId = await getDefaultUserId();
    await updateInvestmentValuation({
      userId,
      accountId: input.account_id,
      currentValue: input.current_value,
      valuationDate: input.valuation_date,
    });
    return { success: true, message: `投资账户估值已更新为 ${input.current_value.toFixed(2)} 元` };
  } catch (err) {
    return handleError(err);
  }
}

// ─── analyze_investment_return ───────────────────────────────────────────────
export const analyzeInvestmentReturnSchema = z.object({
  account_id: z.string().uuid().optional().describe('不填则分析全部'),
});

export async function analyzeInvestmentReturnTool(input: z.infer<typeof analyzeInvestmentReturnSchema>) {
  try {
    const userId = await getDefaultUserId();
    const result = await analyzeInvestmentReturn({ userId, accountId: input.account_id });
    return { success: true, ...result };
  } catch (err) {
    return handleError(err);
  }
}
