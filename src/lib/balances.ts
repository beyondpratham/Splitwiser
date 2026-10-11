import { fromMinor, simplifyDebts, toMinor } from './money';
import type { BalanceRow, Expense, GroupBalanceRow, PairDebt, Profile } from './types';

/** currency → amount */
export type CurrencyMap = Record<string, number>;

function add(map: CurrencyMap, currency: string, amount: number) {
  const next = fromMinor(toMinor(map[currency] ?? 0, currency) + toMinor(amount, currency), currency);
  if (next === 0) delete map[currency];
  else map[currency] = next;
}

/** Non-zero entries, largest first. */
export function entries(map: CurrencyMap | undefined): [string, number][] {
  return Object.entries(map ?? {})
    .filter(([, v]) => Math.abs(v) >= 0.005)
    .sort((a, b) => Math.abs(b[1]) - Math.abs(a[1]));
}

export function summarizeBalances(rows: BalanceRow[]) {
  const total: CurrencyMap = {};
  const owedToMe: CurrencyMap = {};
  const iOwe: CurrencyMap = {};
  const byFriend = new Map<string, CurrencyMap>();
  const byGroup = new Map<string, CurrencyMap>();
  const byFriendGroup = new Map<string, Map<string | null, CurrencyMap>>();

  for (const r of rows) {
    const amt = Number(r.balance);
    add(total, r.currency, amt);
    if (!byFriend.has(r.other_id)) byFriend.set(r.other_id, {});
    add(byFriend.get(r.other_id)!, r.currency, amt);
    const gk = r.group_id ?? 'none';
    if (!byGroup.has(gk)) byGroup.set(gk, {});
    add(byGroup.get(gk)!, r.currency, amt);
    if (!byFriendGroup.has(r.other_id)) byFriendGroup.set(r.other_id, new Map());
    const fg = byFriendGroup.get(r.other_id)!;
    if (!fg.has(r.group_id)) fg.set(r.group_id, {});
    add(fg.get(r.group_id)!, r.currency, amt);
  }
  // owed / owe totals are per-friend nets, like Splitwise's header
  for (const map of byFriend.values()) {
    for (const [cur, v] of Object.entries(map)) add(v > 0 ? owedToMe : iOwe, cur, Math.abs(v));
  }
  return { total, owedToMe, iOwe, byFriend, byGroup, byFriendGroup };
}

export interface MemberDebt {
  from: string;
  to: string;
  currency: string;
  amount: number;
}

/** Who should pay whom in a group. Simplified = fewest payments; otherwise netted pairwise debts. */
export function groupDebts(
  balances: GroupBalanceRow[],
  pairDebts: PairDebt[],
  simplify: boolean,
): MemberDebt[] {
  const out: MemberDebt[] = [];
  if (simplify) {
    const byCurrency = new Map<string, Record<string, number>>();
    for (const b of balances) {
      if (!byCurrency.has(b.currency)) byCurrency.set(b.currency, {});
      byCurrency.get(b.currency)![b.profile_id] = toMinor(Number(b.balance), b.currency);
    }
    for (const [currency, nets] of byCurrency) {
      for (const tr of simplifyDebts(nets)) out.push({ from: tr.from, to: tr.to, currency, amount: fromMinor(tr.amount, currency) });
    }
    return out;
  }
  // net each unordered pair
  const pairs = new Map<string, number>();
  for (const d of pairDebts) {
    const [a, b] = [d.debtor, d.creditor].sort();
    const key = `${a}|${b}|${d.currency}`;
    const sign = d.debtor === a ? 1 : -1; // positive = a owes b
    pairs.set(key, (pairs.get(key) ?? 0) + sign * Number(d.amount));
  }
  for (const [key, v] of pairs) {
    const [a, b, currency] = key.split('|');
    const amount = fromMinor(Math.abs(toMinor(v, currency)), currency);
    if (amount === 0) continue;
    out.push(v > 0 ? { from: a, to: b, currency, amount } : { from: b, to: a, currency, amount });
  }
  return out.sort((x, y) => y.amount - x.amount);
}

/** How an expense affects me. */
export function myImpact(e: Expense, meId: string | undefined) {
  const mine = e.expense_shares.find((s) => s.profile_id === meId);
  const paid = Number(mine?.paid ?? 0);
  const owed = Number(mine?.owed ?? 0);
  return { involved: !!mine, paid, owed, net: Math.round((paid - owed) * 10000) / 10000 };
}

export function payersLabel(e: Expense, people: Map<string, Profile>, meId: string | undefined): string {
  const payers = e.expense_shares.filter((s) => Number(s.paid) > 0);
  if (payers.length !== 1) return `${payers.length} people`;
  return payers[0].profile_id === meId ? 'You' : people.get(payers[0].profile_id)?.name.split(' ')[0] ?? 'Someone';
}

export function firstName(p: Profile | undefined, meId?: string): string {
  if (!p) return 'Someone';
  if (p.id === meId) return 'You';
  return p.name.split(' ')[0];
}
