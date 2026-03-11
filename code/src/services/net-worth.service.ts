import { db } from '../db/client.js';
import { netWorthSnapshots } from '../db/schema.js';
import { eq, and, desc } from 'drizzle-orm';
import { listAccounts } from './accounts.service.js';
import { writeAuditLog } from '../utils/audit.js';
import { formatAmount } from '../utils/response.js';

export async function recordNetWorthSnapshot(params: {
  userId: string;
  note?: string;
}) {
  const { userId, note } = params;

  const accountData = await listAccounts({ userId });
  const today = new Date().toISOString().split('T')[0];

  const accountDetails = accountData.accounts.map((a) => ({
    id: a.account_id,
    name: a.name,
    balance: a.balance,
  }));

  const [snapshot] = await db
    .insert(netWorthSnapshots)
    .values({
      userId,
      snapshotDate: today,
      totalAssets: String(accountData.summary.total_assets),
      totalLiabilities: String(accountData.summary.total_liabilities),
      netWorth: String(accountData.summary.net_worth),
      accountDetails,
      note: note ?? null,
    })
    .onConflictDoUpdate({
      target: [netWorthSnapshots.userId, netWorthSnapshots.snapshotDate],
      set: {
        totalAssets: String(accountData.summary.total_assets),
        totalLiabilities: String(accountData.summary.total_liabilities),
        netWorth: String(accountData.summary.net_worth),
        accountDetails,
        note: note ?? null,
      },
    })
    .returning({ id: netWorthSnapshots.id });

  await writeAuditLog({
    userId,
    action: 'create',
    resourceType: 'net_worth_snapshot',
    resourceId: snapshot.id,
    toolName: 'record_net_worth_snapshot',
  });

  return {
    snapshot_id: snapshot.id,
    snapshot_date: today,
    ...accountData.summary,
  };
}

export async function analyzeNetWorthTrend(params: { userId: string; months?: number }) {
  const { userId, months = 12 } = params;

  const snapshots = await db
    .select()
    .from(netWorthSnapshots)
    .where(eq(netWorthSnapshots.userId, userId))
    .orderBy(desc(netWorthSnapshots.snapshotDate))
    .limit(months);

  const sorted = snapshots.sort((a, b) =>
    a.snapshotDate < b.snapshotDate ? -1 : 1
  );

  return {
    snapshots: sorted.map((s, i) => {
      const prev = i > 0 ? sorted[i - 1] : null;
      const netWorth = formatAmount(s.netWorth);
      const prevNetWorth = prev ? formatAmount(prev.netWorth) : null;
      return {
        snapshot_date: s.snapshotDate,
        total_assets: formatAmount(s.totalAssets),
        total_liabilities: formatAmount(s.totalLiabilities),
        net_worth: netWorth,
        change_from_prev: prevNetWorth !== null ? parseFloat((netWorth - prevNetWorth).toFixed(2)) : null,
        note: s.note,
      };
    }),
  };
}
