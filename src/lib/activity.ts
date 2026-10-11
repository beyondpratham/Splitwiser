import { categoryById } from './categories';
import { formatMoney } from './money';
import type { Activity, Profile, Snapshot } from './types';

export interface Segment {
  text: string;
  bold?: boolean;
}

export function describeActivity(a: Activity, people: Map<string, Profile>, meId: string | undefined): Segment[] {
  const actor = a.actor_id === meId ? 'You' : people.get(a.actor_id ?? '')?.name ?? 'Someone';
  const snap = a.data.after ?? a.data.before;
  const desc = snap?.description ?? a.data.description ?? 'an expense';
  const inGroup: Segment[] = snap?.group_name ? [{ text: ' in ' }, { text: snap.group_name, bold: true }] : [];

  switch (a.kind) {
    case 'expense_added':
      return [{ text: actor, bold: true }, { text: ' added ' }, { text: `“${desc}”`, bold: true }, ...inGroup];
    case 'expense_updated':
      return [{ text: actor, bold: true }, { text: ' updated ' }, { text: `“${desc}”`, bold: true }, ...inGroup];
    case 'expense_deleted':
      return [{ text: actor, bold: true }, { text: ' deleted ' }, { text: `“${desc}”`, bold: true }, ...inGroup];
    case 'expense_restored':
      return [{ text: actor, bold: true }, { text: ' restored ' }, { text: `“${desc}”`, bold: true }, ...inGroup];
    case 'payment_added': {
      const payer = snap?.shares.find((s) => Number(s.paid) > 0);
      const payee = snap?.shares.find((s) => Number(s.owed) > 0);
      const name = (id?: string, fallback?: string) => (id === meId ? 'you' : fallback ?? 'someone');
      return [
        { text: payer?.profile_id === meId ? 'You' : payer?.name ?? 'Someone', bold: true },
        { text: ' paid ' },
        { text: name(payee?.profile_id, payee?.name), bold: true },
        { text: ` ${snap ? formatMoney(Number(snap.amount), snap.currency) : ''}` },
        ...inGroup,
      ];
    }
    case 'comment_added':
      return [{ text: actor, bold: true }, { text: ' commented on ' }, { text: `“${a.data.description ?? 'an expense'}”`, bold: true }];
    case 'group_created':
      return [{ text: actor, bold: true }, { text: ' created the group ' }, { text: a.data.group_name ?? '', bold: true }];
    case 'member_added':
      return [
        { text: actor, bold: true },
        { text: ' added ' },
        { text: a.data.member_id === meId ? 'you' : a.data.member_name ?? 'someone', bold: true },
        { text: ' to ' },
        { text: a.data.group_name ?? 'a group', bold: true },
      ];
    default:
      return [{ text: actor, bold: true }, { text: ' did something' }];
  }
}

/** My net effect from a snapshot: positive = I get back, negative = I owe. */
export function snapshotImpact(s: Snapshot | undefined, meId: string | undefined): number | null {
  const mine = s?.shares.find((x) => x.profile_id === meId);
  if (!mine) return null;
  return Number(mine.paid) - Number(mine.owed);
}

/** Human-readable list of what changed in an edit. */
export function diffSnapshots(before: Snapshot, after: Snapshot): string[] {
  const out: string[] = [];
  if (before.description !== after.description) out.push(`Description: “${before.description}” → “${after.description}”`);
  if (Number(before.amount) !== Number(after.amount) || before.currency !== after.currency)
    out.push(`Amount: ${formatMoney(Number(before.amount), before.currency)} → ${formatMoney(Number(after.amount), after.currency)}`);
  if (before.category !== after.category) out.push(`Category: ${categoryById(before.category).label} → ${categoryById(after.category).label}`);
  if (before.spent_on !== after.spent_on) out.push(`Date: ${before.spent_on} → ${after.spent_on}`);
  if ((before.notes ?? '') !== (after.notes ?? '')) out.push('Notes changed');
  if (before.group_name !== after.group_name) out.push(`Group: ${before.group_name ?? 'none'} → ${after.group_name ?? 'none'}`);
  const key = (s: Snapshot) => s.shares.map((x) => `${x.profile_id}:${x.paid}:${x.owed}`).sort().join(',');
  if (key(before) !== key(after)) {
    const fmt = (v: number) => formatMoney(v, after.currency);
    const names = new Set([...before.shares, ...after.shares].map((s) => s.profile_id));
    for (const id of names) {
      const b = before.shares.find((s) => s.profile_id === id);
      const a = after.shares.find((s) => s.profile_id === id);
      const name = a?.name ?? b?.name ?? 'Someone';
      if (Number(b?.paid ?? 0) !== Number(a?.paid ?? 0)) out.push(`${name} paid ${fmt(Number(b?.paid ?? 0))} → ${fmt(Number(a?.paid ?? 0))}`);
      if (Number(b?.owed ?? 0) !== Number(a?.owed ?? 0)) out.push(`${name}’s share ${fmt(Number(b?.owed ?? 0))} → ${fmt(Number(a?.owed ?? 0))}`);
    }
  }
  return out.length ? out : ['No visible changes'];
}

export function timeAgo(iso: string): string {
  const diff = (Date.now() - new Date(iso).getTime()) / 1000;
  if (diff < 60) return 'just now';
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  if (diff < 86400 * 7) return `${Math.floor(diff / 86400)}d ago`;
  return new Date(iso).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: diff > 86400 * 300 ? 'numeric' : undefined });
}
