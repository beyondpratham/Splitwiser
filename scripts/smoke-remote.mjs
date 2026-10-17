// Smoke test against the real Supabase project in .env, with two throwaway accounts that are
// deleted again at the end (their group is deleted first, so nothing is left behind).
// Usage: npm run test:remote
import { createClient } from '@supabase/supabase-js';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const env = Object.fromEntries(
  readFileSync('.env', 'utf8')
    .split(/\r?\n/)
    .filter((l) => l.includes('=') && !l.startsWith('#'))
    .map((l) => [l.slice(0, l.indexOf('=')).trim(), l.slice(l.indexOf('=') + 1).trim()]),
);
const URL = env.EXPO_PUBLIC_SUPABASE_URL;
const KEY = env.EXPO_PUBLIC_SUPABASE_KEY;
if (!URL || !KEY || URL.includes('YOUR-PROJECT')) throw new Error('Set EXPO_PUBLIC_SUPABASE_URL and EXPO_PUBLIC_SUPABASE_KEY in .env');

const client = () => createClient(URL, KEY, { auth: { persistSession: false, autoRefreshToken: false } });
const ok = ({ data, error }) => {
  if (error) throw new Error(error.message);
  return data;
};
let passed = 0;
const check = async (name, fn) => {
  await fn();
  passed++;
  console.log(`  ✓ ${name}`);
};

const stamp = Date.now().toString(36);
const emails = [`splitwiser.smoke.${stamp}.a@mailinator.com`, `splitwiser.smoke.${stamp}.b@mailinator.com`];
const a = client();
const b = client();
let groupId;

console.log(`Smoke test against ${URL}`);
try {
  await check('schema is installed', async () => {
    const { error } = await client().from('profiles').select('id').limit(1);
    assert.equal(error, null, error?.message);
  });

  await check('sign up two people (email confirmation is off)', async () => {
    for (const [i, c] of [a, b].entries()) {
      const { session } = ok(await c.auth.signUp({ email: emails[i], password: `Smoke-${stamp}-pw`, options: { data: { name: `Smoke ${'AB'[i]}` } } }));
      assert.ok(session, 'No session returned because "Confirm email" is on (that is the safe setting for real users). This test needs throwaway accounts, so it only runs while confirmation is off.');
    }
  });

  const meA = ok(await a.from('profiles').select('id, name').eq('user_id', ok(await a.auth.getUser()).user.id).single());
  const meB = ok(await b.from('profiles').select('id, name').eq('user_id', ok(await b.auth.getUser()).user.id).single());
  await check('profiles were created by the sign-up trigger', async () => assert.equal(meA.name, 'Smoke A'));

  await check('add friend and create a group', async () => {
    assert.equal(ok(await a.rpc('add_friend', { friend_email: emails[1] })), meB.id);
    groupId = ok(await a.rpc('create_group', { group_name: 'Smoke test', group_emoji: '🧪', group_kind: 'other', currency: 'USD', member_ids: [meB.id] }));
    assert.equal(ok(await b.from('groups').select('*, group_members(profile_id)').eq('id', groupId).single()).group_members.length, 2);
  });

  // Hosted Realtime reports SUBSCRIBED slightly before database changes start flowing; it sends a
  // "system" message once the postgres_changes listener is live, so wait for that.
  const events = [];
  let ready;
  const live = new Promise((r) => (ready = r));
  const channel = b
    .channel('smoke')
    .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'activity' }, (p) => events.push(p))
    .on('system', {}, (p) => p?.extension === 'postgres_changes' && p?.status === 'ok' && ready());
  await new Promise((resolve, reject) => {
    channel.subscribe((status, err) => (status === 'SUBSCRIBED' ? resolve() : err && reject(err)));
    setTimeout(() => reject(new Error('realtime subscribe timed out')), 10000);
  });
  await Promise.race([live, new Promise((r) => setTimeout(r, 8000))]);

  let expenseId;
  await check('add an expense; balances agree on both sides', async () => {
    expenseId = ok(
      await a.rpc('save_expense', {
        payload: {
          group_id: groupId, description: 'Smoke pizza', amount: 30, currency: 'USD', category: 'dining', split_type: 'equal',
          spent_on: new Date().toISOString().slice(0, 10),
          shares: [{ profile_id: meA.id, paid: 30, owed: 15 }, { profile_id: meB.id, paid: 0, owed: 15 }],
        },
      }),
    );
    const balA = ok(await a.from('my_balances').select('*').eq('other_id', meB.id));
    const balB = ok(await b.from('my_balances').select('*').eq('other_id', meA.id));
    assert.equal(Number(balA[0].balance), 15);
    assert.equal(Number(balB[0].balance), -15);
  });

  await check('realtime tells the other person', async () => {
    for (let i = 0; i < 50 && !events.length; i++) await new Promise((r) => setTimeout(r, 200));
    assert.ok(events.length > 0, 'no realtime event: is the activity table in the supabase_realtime publication?');
  });

  await check('comment, delete and restore', async () => {
    ok(await b.rpc('add_comment', { eid: expenseId, comment_body: 'Thanks!' }));
    assert.equal(ok(await a.from('comments').select('*').eq('expense_id', expenseId)).length, 1);
    ok(await a.rpc('delete_expense', { eid: expenseId }));
    ok(await a.rpc('restore_expense', { eid: expenseId }));
  });

  await check('row level security hides everything from strangers', async () => {
    const stranger = client();
    assert.equal(ok(await stranger.from('expenses').select('*')).length, 0);
    const { error } = await a.from('profiles').update({ email: 'hijack@example.com' }).eq('id', meA.id);
    assert.ok(error, 'email column should not be writable');
  });

  await check('phone numbers, preset avatars and one device per account', async () => {
    const phone = `+9199${String(Date.now()).slice(-8)}`;
    ok(await a.from('profiles').update({ phone, avatar: 'emoji:fox', avatar_color: '#E8590C' }).eq('id', meA.id));
    const { error } = await b.from('profiles').update({ phone }).eq('id', meB.id);
    assert.match(error?.message ?? '', /profiles_phone_key|duplicate/, 'a phone number belongs to one account');
    ok(await a.rpc('claim_device', { device: `smoke-${stamp}` }));
    assert.equal(ok(await a.from('active_devices').select('device_id')).at(0)?.device_id, `smoke-${stamp}`);
  });

  await check('notification settings and reminders', async () => {
    assert.equal(ok(await b.rpc('my_notification_prefs')).reminders, 'both');
    ok(await b.rpc('set_notification_pref', { category: 'expenses', channel: 'email' }));
    assert.equal(ok(await b.rpc('my_notification_prefs')).expenses, 'email');
    ok(await a.rpc('send_reminder', { fid: meB.id })); // b owes a 15
    const again = await a.rpc('send_reminder', { fid: meB.id });
    assert.match(again.error?.message ?? '', /already reminded/);
    const { error } = await a.from('notification_outbox').select('*');
    assert.ok(error, 'the notification queue is private');
  });

  await check('removing a friend is blocked while you share a group', async () => {
    const { error } = await a.rpc('remove_friend', { fid: meB.id });
    assert.match(error?.message ?? '', /share a group|settle up/);
  });

  await b.removeChannel(channel);
} finally {
  // Clean up: delete the group (cascades its expenses), then both accounts.
  try {
    if (groupId) await a.from('groups').delete().eq('id', groupId);
    for (const c of [a, b]) {
      const { data } = await c.auth.getSession();
      if (data.session) await c.rpc('delete_my_account');
    }
    console.log('  ✓ cleaned up test accounts and data');
  } catch (e) {
    console.log(`  ! cleanup problem: ${e.message}`);
  }
}
console.log(`✓ ${passed} checks passed against your Supabase project`);
process.exit(0);
