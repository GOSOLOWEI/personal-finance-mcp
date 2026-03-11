import { db } from '../db/client.js';
import { amortizations, transactions } from '../db/schema.js';
import { eq, and, isNull } from 'drizzle-orm';
import { FinanceError } from '../utils/errors.js';
import { writeAuditLog } from '../utils/audit.js';
import { formatAmount } from '../utils/response.js';

function addMonths(yearMonth: string, n: number): string {
  const [year, month] = yearMonth.split('-').map(Number);
  const date = new Date(year, month - 1 + n, 1);
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
}

function monthDiff(start: string, end: string): number {
  const [sy, sm] = start.split('-').map(Number);
  const [ey, em] = end.split('-').map(Number);
  return (ey - sy) * 12 + (em - sm);
}

function getCurrentYearMonth(): string {
  const now = new Date();
  return now.toLocaleString('zh-CN', { timeZone: 'Asia/Shanghai', year: 'numeric', month: '2-digit' })
    .replace(/\//g, '-')
    .substring(0, 7);
}

export async function createAmortization(params: {
  userId: string;
  transactionId: string;
  startMonth: string;
  totalMonths: number;
  note?: string;
}) {
  const { userId, transactionId, startMonth, totalMonths, note } = params;

  if (totalMonths < 2) {
    throw new FinanceError('AMORTIZATION_MONTHS_TOO_FEW', '分摊月数至少为 2 个月');
  }

  // 查询交易记录
  const [tx] = await db
    .select()
    .from(transactions)
    .where(and(eq(transactions.id, transactionId), eq(transactions.userId, userId), isNull(transactions.deletedAt)))
    .limit(1);

  if (!tx) {
    throw new FinanceError('NOT_FOUND', `交易记录 ${transactionId} 不存在`);
  }

  if (tx.type !== 'expense') {
    throw new FinanceError('AMORTIZATION_NOT_EXPENSE', '只有支出类型的交易才能创建分摊计划');
  }

  const totalAmount = formatAmount(tx.amount);
  const monthlyAmount = parseFloat((totalAmount / totalMonths).toFixed(2));

  const [amortz] = await db
    .insert(amortizations)
    .values({
      userId,
      transactionId,
      totalAmount: String(totalAmount),
      monthlyAmount: String(monthlyAmount),
      startMonth,
      totalMonths,
      note: note ?? null,
    })
    .returning({ id: amortizations.id });

  // 生成分摊计划预览
  const schedule = Array.from({ length: totalMonths }, (_, i) => {
    const month = addMonths(startMonth, i);
    const isLast = i === totalMonths - 1;
    const amount = isLast
      ? parseFloat((totalAmount - monthlyAmount * (totalMonths - 1)).toFixed(2))
      : monthlyAmount;
    return { month, amount };
  });

  await writeAuditLog({
    userId,
    action: 'create',
    resourceType: 'amortization',
    resourceId: amortz.id,
    changes: { after: params },
    toolName: 'record_amortization',
  });

  return {
    amortization_id: amortz.id,
    monthly_amount: monthlyAmount,
    schedule,
  };
}

export async function updateAmortization(
  amortizationId: string,
  userId: string,
  params: {
    totalMonths?: number;
    status?: 'active' | 'cancelled';
    note?: string;
  }
): Promise<void> {
  const [existing] = await db
    .select()
    .from(amortizations)
    .where(and(eq(amortizations.id, amortizationId), eq(amortizations.userId, userId)))
    .limit(1);

  if (!existing) {
    throw new FinanceError('NOT_FOUND', `分摊计划 ${amortizationId} 不存在`);
  }

  if (params.totalMonths !== undefined) {
    const currentMonth = getCurrentYearMonth();
    const elapsed = Math.max(0, monthDiff(existing.startMonth, currentMonth));

    if (params.totalMonths < elapsed) {
      throw new FinanceError(
        'AMORTIZATION_MONTHS_TOO_FEW',
        `修改月数 (${params.totalMonths}) 不能少于已摊销月数 (${elapsed})`
      );
    }

    if (params.totalMonths < 2) {
      throw new FinanceError('AMORTIZATION_MONTHS_TOO_FEW', '分摊月数至少为 2 个月');
    }
  }

  const updateData: Record<string, unknown> = { updatedAt: new Date() };
  if (params.totalMonths !== undefined) {
    updateData.totalMonths = params.totalMonths;
    const totalAmount = formatAmount(existing.totalAmount);
    updateData.monthlyAmount = String(parseFloat((totalAmount / params.totalMonths).toFixed(2)));
  }
  if (params.status !== undefined) updateData.status = params.status;
  if (params.note !== undefined) updateData.note = params.note;

  await db.update(amortizations).set(updateData as Partial<typeof amortizations.$inferInsert>).where(eq(amortizations.id, amortizationId));

  await writeAuditLog({
    userId,
    action: 'update',
    resourceType: 'amortization',
    resourceId: amortizationId,
    changes: { before: existing, after: params },
    toolName: 'update_amortization',
  });
}

export async function listAmortizations(params: {
  userId: string;
  status?: string;
  yearMonth?: string;
}) {
  const { userId, status = 'active', yearMonth } = params;

  const allAmortizations = await db
    .select({
      id: amortizations.id,
      transactionId: amortizations.transactionId,
      totalAmount: amortizations.totalAmount,
      monthlyAmount: amortizations.monthlyAmount,
      startMonth: amortizations.startMonth,
      totalMonths: amortizations.totalMonths,
      status: amortizations.status,
      note: amortizations.note,
      txNote: transactions.note,
    })
    .from(amortizations)
    .innerJoin(transactions, eq(transactions.id, amortizations.transactionId))
    .where(and(eq(amortizations.userId, userId)));

  const currentMonth = getCurrentYearMonth();

  const result = allAmortizations
    .filter((a) => {
      if (status !== 'all' && a.status !== status) return false;
      if (yearMonth) {
        const endMonth = addMonths(a.startMonth, a.totalMonths - 1);
        if (yearMonth < a.startMonth || yearMonth > endMonth) return false;
      }
      return true;
    })
    .map((a) => {
      const endMonth = addMonths(a.startMonth, a.totalMonths - 1);
      const elapsed = Math.max(0, Math.min(a.totalMonths, monthDiff(a.startMonth, currentMonth) + 1));
      const remaining = a.totalMonths - elapsed;

      return {
        amortization_id: a.id,
        transaction_note: a.txNote ?? '（无备注）',
        total_amount: formatAmount(a.totalAmount),
        monthly_amount: formatAmount(a.monthlyAmount),
        start_month: a.startMonth,
        end_month: endMonth,
        total_months: a.totalMonths,
        elapsed_months: elapsed,
        remaining_months: remaining,
        status: a.status,
        note: a.note,
      };
    });

  return { amortizations: result };
}
