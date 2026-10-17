import type { Expense } from './types';

function monthKey(d: Date) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

/** The currency most of these expenses use. */
export function mainCurrency(expenses: Expense[], fallback: string) {
  const counts = new Map<string, number>();
  for (const e of expenses) if (!e.is_payment) counts.set(e.currency, (counts.get(e.currency) ?? 0) + 1);
  return [...counts.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] ?? fallback;
}

/** My share of spending per month for the last `months` months (oldest first), in one currency. */
export function monthlyShare(expenses: Expense[], meId: string | undefined, currency: string, months = 6) {
  const now = new Date();
  const keys = Array.from({ length: months }, (_, i) => monthKey(new Date(now.getFullYear(), now.getMonth() - months + 1 + i, 1)));
  const totals = new Map(keys.map((k) => [k, 0]));
  for (const e of expenses) {
    if (e.is_payment || e.currency !== currency) continue;
    const k = String(e.spent_on).slice(0, 7);
    if (!totals.has(k)) continue;
    const mine = Number(e.expense_shares.find((s) => s.profile_id === meId)?.owed ?? 0);
    totals.set(k, totals.get(k)! + mine);
  }
  return keys.map((k) => ({ month: k, total: totals.get(k)! }));
}
