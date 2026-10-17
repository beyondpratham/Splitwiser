// Delivers queued notifications (public.notification_outbox) by push and/or email.
//
// Called by:
//   • a database webhook on INSERT into notification_outbox   → sends that row
//   • a schedule with body {"weekly": true}                     → queues and sends the weekly summary
//   • a schedule with body {} (optional backstop)               → sends anything still unsent
//
// Secrets (Edge Functions → Secrets): RESEND_API_KEY, EMAIL_FROM, optionally EXPO_ACCESS_TOKEN.
// SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are provided by Supabase automatically.
import { createClient } from 'npm:@supabase/supabase-js@2';
import { buildMessage, emailHtml, type Category, type Message } from '../_shared/messages.ts';

const db = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!, { auth: { persistSession: false } });
const RESEND_API_KEY = Deno.env.get('RESEND_API_KEY');
const EMAIL_FROM = Deno.env.get('EMAIL_FROM') ?? 'SplitWiser <onboarding@resend.dev>';
const EXPO_ACCESS_TOKEN = Deno.env.get('EXPO_ACCESS_TOKEN');

interface OutboxRow {
  id: number;
  profile_id: string;
  category: Category;
  channels: string[];
  actor_id: string | null;
  activity_id: string | null;
  data: Record<string, unknown>;
}

async function sendPush(profileId: string, message: Message) {
  const { data: tokens } = await db.from('push_tokens').select('token').eq('profile_id', profileId);
  if (!tokens?.length) return 'no device';
  const res = await fetch('https://exp.host/--/api/v2/push/send', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...(EXPO_ACCESS_TOKEN ? { Authorization: `Bearer ${EXPO_ACCESS_TOKEN}` } : {}) },
    body: JSON.stringify(tokens.map(({ token }) => ({ to: token, title: message.title, body: message.body, data: { url: message.url }, sound: 'default', channelId: 'default' }))),
  });
  if (!res.ok) throw new Error(`push failed: ${res.status} ${await res.text()}`);
  const { data: tickets } = (await res.json()) as { data: { status: string; details?: { error?: string } }[] };
  // forget devices that uninstalled the app
  const gone = tickets.map((t, i) => (t.details?.error === 'DeviceNotRegistered' ? tokens[i].token : null)).filter(Boolean);
  if (gone.length) await db.from('push_tokens').delete().in('token', gone);
  return null;
}

async function sendEmail(to: string, name: string, message: Message) {
  if (!RESEND_API_KEY) return 'email not set up';
  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${RESEND_API_KEY}` },
    body: JSON.stringify({ from: EMAIL_FROM, to, subject: message.title, text: `${message.body}\n\nOpen SplitWiser to see the details.`, html: emailHtml(message, name) }),
  });
  if (!res.ok) throw new Error(`email failed: ${res.status} ${await res.text()}`);
  return null;
}

async function deliver(row: OutboxRow) {
  const ids = [row.profile_id, row.actor_id].filter(Boolean) as string[];
  const { data: people } = await db.from('profiles').select('id, name, email').in('id', ids);
  const recipient = people?.find((p) => p.id === row.profile_id);
  if (!recipient) return 'recipient gone';
  const actor = people?.find((p) => p.id === row.actor_id);
  const activity = row.activity_id ? (await db.from('activity').select('kind, group_id, expense_id, data').eq('id', row.activity_id).maybeSingle()).data : null;

  const message = buildMessage({ category: row.category, recipientId: row.profile_id, actorId: row.actor_id, actorName: actor?.name, activity, data: row.data });
  const problems: string[] = [];
  if (row.channels.includes('push')) problems.push((await sendPush(row.profile_id, message)) ?? '');
  if (row.channels.includes('email') && recipient.email) problems.push((await sendEmail(recipient.email, recipient.name, message)) ?? '');
  return problems.filter(Boolean).join('; ') || null;
}

async function drain(only?: number) {
  let query = db.from('notification_outbox').select('*').is('sent_at', null).order('id').limit(100);
  if (only) query = query.eq('id', only);
  const { data: rows, error } = await query;
  if (error) throw error;
  let sent = 0;
  for (const row of (rows ?? []) as OutboxRow[]) {
    // claim the row first so a webhook and a backstop run never send it twice
    const { data: claimed } = await db.from('notification_outbox').update({ sent_at: new Date().toISOString() }).eq('id', row.id).is('sent_at', null).select('id');
    if (!claimed?.length) continue;
    try {
      const note = await deliver(row);
      if (note) await db.from('notification_outbox').update({ error: note }).eq('id', row.id);
      sent++;
    } catch (e) {
      await db.from('notification_outbox').update({ sent_at: null, error: String((e as Error).message ?? e) }).eq('id', row.id);
    }
  }
  return { sent };
}

async function queueWeekly() {
  const { data, error } = await db.rpc('weekly_summaries');
  if (error) throw error;
  const rows = (data ?? []).map((r: { profile_id: string; channels: string[]; owed: unknown; owe: unknown; new_expenses: number }) => ({
    profile_id: r.profile_id,
    category: 'weekly',
    channels: r.channels,
    data: { owed: r.owed, owe: r.owe, new_expenses: r.new_expenses },
  }));
  if (rows.length) await db.from('notification_outbox').insert(rows);
  return rows.length;
}

Deno.serve(async (req) => {
  try {
    const body = await req.json().catch(() => ({}));
    if (body.weekly) {
      const queued = await queueWeekly();
      return Response.json({ queued, ...(await drain()) });
    }
    return Response.json(await drain(body.record?.id));
  } catch (e) {
    return Response.json({ error: String((e as Error).message ?? e) }, { status: 500 });
  }
});
