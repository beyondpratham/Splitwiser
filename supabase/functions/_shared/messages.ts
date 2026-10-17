// Wording for every notification, shared by push and email. Pure functions so they can be tested in Node
// (scripts/notifications.test.ts) and used by the Deno edge function.

export type Category = 'expenses' | 'payments' | 'comments' | 'friends' | 'reminders' | 'weekly';

export interface Share {
  profile_id: string;
  paid: number | string;
  owed: number | string;
}

export interface Snapshot {
  description: string;
  amount: number | string;
  currency: string;
  is_payment?: boolean;
  group_name?: string | null;
  shares?: Share[];
}

export interface ActivityRow {
  kind: string;
  group_id: string | null;
  expense_id: string | null;
  data: { after?: Snapshot; before?: Snapshot; body?: string; description?: string; group_name?: string; member_name?: string };
}

export interface Amount {
  currency: string;
  amount: number | string;
}

export interface MessageInput {
  category: Category;
  recipientId: string;
  actorId?: string | null;
  actorName?: string | null;
  activity?: ActivityRow | null;
  data?: { event?: string; owed?: Amount[]; new_expenses?: number; owe?: Amount[] };
}

export interface Message {
  title: string;
  body: string;
  /** Screen in the app to open when tapped. */
  url: string;
}

export function money(amount: number | string, currency: string) {
  const value = Number(amount);
  try {
    return new Intl.NumberFormat(currency === 'INR' ? 'en-IN' : 'en-US', { style: 'currency', currency, currencyDisplay: 'narrowSymbol' }).format(value);
  } catch {
    return `${currency} ${value.toFixed(2)}`;
  }
}

const list = (amounts: Amount[] = []) => amounts.map((a) => money(a.amount, a.currency)).join(' + ');
const first = (name: string) => name.split(' ')[0];

/** What this expense means for the recipient: "You owe ₹400", "You get back ₹800" or nothing. */
function yourShare(snap: Snapshot, recipientId: string) {
  const mine = snap.shares?.find((s) => s.profile_id === recipientId);
  if (!mine) return '';
  const net = Number(mine.paid) - Number(mine.owed);
  if (Math.abs(net) < 0.005) return ' You don’t owe anything.';
  return net < 0 ? ` You owe ${money(-net, snap.currency)}.` : ` You get back ${money(net, snap.currency)}.`;
}

export function buildMessage({ category, recipientId, actorId, actorName, activity, data = {} }: MessageInput): Message {
  const who = actorName || 'Someone';
  const kind = activity?.kind;

  if (category === 'weekly') {
    const parts = [];
    if (data.owed?.length) parts.push(`You’re owed ${list(data.owed)}`);
    if (data.owe?.length) parts.push(`you owe ${list(data.owe)}`);
    if (!parts.length) parts.push('You’re all settled up');
    const fresh = data.new_expenses ?? 0;
    const tail = fresh ? ` ${fresh} new ${fresh === 1 ? 'expense' : 'expenses'} this week.` : '';
    return { title: 'Your week on SplitWiser', body: `${parts.join(', ')}.${tail}`, url: '/friends' };
  }

  if (category === 'reminders') {
    return {
      title: `${who} sent you a reminder`,
      body: `You owe ${first(who)} ${list(data.owed)}. Settle up whenever you’re ready.`,
      url: actorId ? `/friend/${actorId}` : '/friends',
    };
  }

  if (category === 'friends') {
    if (data.event === 'friend_added' || !activity) {
      return { title: 'New friend', body: `${who} added you as a friend on SplitWiser.`, url: actorId ? `/friend/${actorId}` : '/friends' };
    }
    const group = activity.data.group_name ?? 'a group';
    return { title: `You’re in “${group}”`, body: `${who} added you to the group “${group}”.`, url: activity.group_id ? `/group/${activity.group_id}` : '/groups' };
  }

  const url = activity?.expense_id ? `/expense/${activity.expense_id}` : '/activity';

  if (category === 'comments') {
    const about = activity?.data.description ?? 'an expense';
    return { title: `${who} commented on “${about}”`, body: activity?.data.body ?? '', url };
  }

  const snap = activity?.data.after ?? activity?.data.before;
  if (!snap) return { title: 'SplitWiser', body: `${who} made a change.`, url };
  const total = money(snap.amount, snap.currency);
  const where = snap.group_name ? ` in ${snap.group_name}` : '';

  if (category === 'payments') {
    const mine = snap.shares?.find((s) => s.profile_id === recipientId);
    const toMe = mine && Number(mine.owed) > 0;
    const verb = kind === 'expense_deleted' ? 'deleted a payment of' : kind === 'expense_updated' ? 'edited a payment of' : toMe ? 'paid you' : 'recorded a payment of';
    return { title: toMe && kind === 'payment_added' ? `${who} paid you ${total}` : 'Payment', body: `${who} ${verb} ${total}${where}.`, url };
  }

  const verb =
    kind === 'expense_updated' ? 'updated' : kind === 'expense_deleted' ? 'deleted' : kind === 'expense_restored' ? 'restored' : 'added';
  const share = kind === 'expense_deleted' ? '' : yourShare(snap, recipientId);
  return { title: snap.description, body: `${who} ${verb} “${snap.description}” (${total})${where}.${share}`, url };
}

const escape = (s: string) => s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!);

/** A small, plain email: the same words as the push, plus how to change these emails. */
export function emailHtml(message: Message, recipientName: string) {
  return `<!doctype html><html><body style="margin:0;background:#E8F5EC;font-family:Inter,Segoe UI,Roboto,Arial,sans-serif;color:#0E1A14">
<table width="100%" cellpadding="0" cellspacing="0"><tr><td align="center" style="padding:32px 16px">
<table width="100%" cellpadding="0" cellspacing="0" style="max-width:480px;background:#ffffff;border-radius:24px">
<tr><td style="padding:28px 28px 8px;font-size:15px;color:#4A5A52">Hi ${escape(first(recipientName || 'there'))},</td></tr>
<tr><td style="padding:4px 28px;font-size:20px;font-weight:700">${escape(message.title)}</td></tr>
<tr><td style="padding:8px 28px 24px;font-size:16px;line-height:1.5">${escape(message.body)}</td></tr>
<tr><td style="padding:0 28px 28px;font-size:13px;color:#6B7B73">Open SplitWiser to see the details. You can choose which emails you get in Settings → Notifications.</td></tr>
</table></td></tr></table></body></html>`;
}
