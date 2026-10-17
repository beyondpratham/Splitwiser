// Contract test: drives the local backend with the real supabase-js client, using the same query
// shapes as src/lib/api.ts, to prove the app works against it. Usage: npm run test:local
import { createClient } from '@supabase/supabase-js';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const PORT = 54399;
const URL = `http://localhost:${PORT}`;
const dir = mkdtempSync(join(tmpdir(), 'splitwiser-'));
const server = spawn(process.execPath, ['scripts/local-backend.mjs'], { env: { ...process.env, PORT: String(PORT), LOCAL_DB_DIR: dir }, stdio: ['ignore', 'pipe', 'inherit'] });
await new Promise((resolve, reject) => {
  server.stdout.on('data', (d) => d.toString().includes('local backend on') && resolve());
  server.on('exit', (code) => reject(new Error(`server exited with ${code}`)));
});

const client = () => createClient(URL, 'local-development-anon-key', { auth: { persistSession: false, autoRefreshToken: false } });
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

try {
  const alex = client();
  const sam = client();

  await check('wrong password is rejected with the GoTrue message', async () => {
    const { error } = await alex.auth.signInWithPassword({ email: 'alex@demo.app', password: 'nope' });
    assert.match(error.message, /Invalid login credentials/);
  });
  await check('sign in, get user and refresh the session', async () => {
    ok(await alex.auth.signInWithPassword({ email: 'alex@demo.app', password: 'demo1234' }));
    ok(await sam.auth.signInWithPassword({ email: 'sam@demo.app', password: 'demo1234' }));
    assert.equal(ok(await alex.auth.getUser()).user.email, 'alex@demo.app');
    assert.ok(ok(await alex.auth.refreshSession()).session.access_token);
  });

  const { id: uid } = ok(await alex.auth.getUser()).user;
  const me = ok(await alex.from('profiles').select('id, name, email').eq('user_id', uid).single());
  await check('profile via .single()', async () => assert.equal(me.name, 'Alex Morgan'));

  await check('profiles, friendships and groups with embedded members', async () => {
    assert.ok(ok(await alex.from('profiles').select('id')).length >= 5);
    assert.equal(ok(await alex.from('friendships').select('friend_id').eq('profile_id', me.id)).length, 4);
    const groups = ok(await alex.from('groups').select('*, group_members(profile_id)').order('created_at', { ascending: false }));
    assert.equal(groups.length, 2);
    assert.ok(groups.every((g) => g.group_members.length === 3 && g.group_members[0].profile_id));
  });

  const groups = ok(await alex.from('groups').select('*, group_members(profile_id)'));
  const flat = groups.find((g) => g.name === 'Flat 4B');

  await check('group expenses with embedded shares, filters and ordering', async () => {
    const list = ok(
      await alex.from('expenses').select('*, expense_shares(*)').eq('group_id', flat.id).is('deleted_at', null).order('spent_on', { ascending: false }).order('created_at', { ascending: false }),
    );
    assert.ok(list.length > 20);
    assert.ok(list[0].spent_on >= list.at(-1).spent_on);
    assert.ok(list.every((e) => e.expense_shares.length >= 2));
  });

  await check('balance views', async () => {
    const mine = ok(await alex.from('my_balances').select('*'));
    assert.ok(mine.length > 0 && mine.every((r) => typeof Number(r.balance) === 'number'));
    assert.equal(ok(await alex.from('group_balances').select('*').eq('group_id', flat.id)).length, 3);
    assert.ok(ok(await alex.from('pair_debts').select('*').eq('group_id', flat.id)).length > 0);
  });

  await check('expenses by id list (.in) and activity feed (.neq, .limit)', async () => {
    const ids = ok(await alex.from('expense_shares').select('expense_id').eq('profile_id', me.id)).map((r) => r.expense_id);
    const list = ok(await alex.from('expenses').select('*, expense_shares(*)').in('id', ids).is('deleted_at', null));
    assert.equal(list.length, new Set(ids).size);
    const feed = ok(await alex.from('activity').select('*').order('created_at', { ascending: false }).limit(10));
    assert.equal(feed.length, 10);
    const nonComments = ok(await alex.from('activity').select('*').neq('kind', 'comment_added'));
    assert.ok(nonComments.every((a) => a.kind !== 'comment_added'));
  });

  // realtime: Sam listens, Alex writes
  const events = [];
  const channel = sam
    .channel('activity-feed')
    .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'activity' }, (p) => events.push(p));
  await new Promise((resolve, reject) => {
    channel.subscribe((status, err) => (status === 'SUBSCRIBED' ? resolve() : err && reject(err)));
    setTimeout(() => reject(new Error('realtime subscribe timed out')), 5000);
  });

  let newId;
  await check('save_expense rpc returns the new id', async () => {
    newId = ok(
      await alex.rpc('save_expense', {
        payload: {
          group_id: flat.id, description: 'Pizza night', amount: 45, currency: 'USD', category: 'dining', split_type: 'equal', spent_on: new Date().toISOString().slice(0, 10),
          shares: flat.group_members.map((m) => ({ profile_id: m.profile_id, paid: m.profile_id === me.id ? 45 : 0, owed: 15 })),
        },
      }),
    );
    assert.match(newId, /^[0-9a-f-]{36}$/);
  });

  await check('realtime delivers the activity row to another member', async () => {
    for (let i = 0; i < 30 && !events.length; i++) await new Promise((r) => setTimeout(r, 100));
    assert.equal(events[0]?.new?.kind, 'expense_added');
  });

  await check('validation errors come back as messages', async () => {
    const { error } = await alex.rpc('save_expense', { payload: { group_id: flat.id, description: 'Bad', amount: 10, shares: [{ profile_id: me.id, paid: 10, owed: 1 }, { profile_id: flat.group_members[1].profile_id, paid: 0, owed: 1 }] } });
    assert.match(error.message, /must add up/);
  });

  await check('comments: add, list, delete', async () => {
    ok(await alex.rpc('add_comment', { eid: newId, comment_body: 'Extra cheese next time' }));
    const list = ok(await alex.from('comments').select('*').eq('expense_id', newId).order('created_at', { ascending: true }));
    assert.equal(list.length, 1);
    ok(await alex.from('comments').delete().eq('id', list[0].id));
    assert.equal(ok(await alex.from('comments').select('*').eq('expense_id', newId)).length, 0);
  });

  await check('delete and restore (void rpcs)', async () => {
    assert.equal(ok(await alex.rpc('delete_expense', { eid: newId })), null);
    assert.ok(ok(await alex.from('expenses').select('*, expense_shares(*)').eq('id', newId).single()).deleted_at);
    ok(await alex.rpc('restore_expense', { eid: newId }));
    assert.equal(ok(await alex.from('expenses').select('*').eq('id', newId).single()).deleted_at, null);
  });

  await check('updates through RLS + column grants', async () => {
    ok(await alex.from('profiles').update({ name: 'Alex M.' }).eq('id', me.id));
    assert.equal(ok(await alex.from('profiles').select('name').eq('id', me.id).single()).name, 'Alex M.');
    ok(await alex.from('groups').update({ simplify_debts: false }).eq('id', flat.id));
    const { error } = await alex.from('profiles').update({ email: 'x@y.z' }).eq('id', me.id);
    assert.match(error.message, /permission denied/);
  });

  await check('sign up creates a profile; a stranger sees nothing', async () => {
    const newbie = client();
    const { session } = ok(await newbie.auth.signUp({ email: 'newbie@demo.app', password: 'secret12', options: { data: { name: 'New Person' } } }));
    assert.ok(session?.access_token);
    assert.equal(ok(await newbie.from('profiles').select('id')).length, 1);
    assert.equal(ok(await newbie.from('expenses').select('*')).length, 0);
    const again = await newbie.auth.signUp({ email: 'newbie@demo.app', password: 'secret12' });
    assert.match(again.error.message, /already registered/);
  });

  await check('friend + group rpcs', async () => {
    const fid = ok(await alex.rpc('add_friend', { friend_email: 'newbie@demo.app' }));
    const gid = ok(await alex.rpc('create_group', { group_name: 'Book club', group_emoji: '📚', group_kind: 'other', currency: 'EUR', member_ids: [fid] }));
    const g = ok(await alex.from('groups').select('*, group_members(profile_id)').eq('id', gid).single());
    assert.equal(g.group_members.length, 2);
  });

  await check('notification settings round-trip', async () => {
    const prefs = ok(await alex.rpc('my_notification_prefs'));
    assert.equal(prefs.payments, 'both');
    ok(await alex.rpc('set_notification_pref', { category: 'payments', channel: 'email' }));
    assert.equal(ok(await alex.rpc('my_notification_prefs')).payments, 'email');
    const { error } = await alex.rpc('set_notification_pref', { category: 'payments', channel: 'pigeon' });
    assert.match(error.message, /unknown notification channel/);
  });

  await check('forgot password: code by "email", then a new password signs in', async () => {
    const forgetful = client();
    ok(await forgetful.auth.resetPasswordForEmail('priya@demo.app'));
    const { code } = await (await fetch(`${URL}/auth/v1/__dev/recovery-code?email=priya@demo.app`)).json();
    assert.match(code, /^\d{6}$/);
    const wrong = await forgetful.auth.verifyOtp({ email: 'priya@demo.app', token: '000000', type: 'recovery' });
    assert.ok(wrong.error, 'wrong code is rejected');
    ok(await forgetful.auth.verifyOtp({ email: 'priya@demo.app', token: code, type: 'recovery' }));
    ok(await forgetful.auth.updateUser({ password: 'brandnew99' }));
    ok(await client().auth.signInWithPassword({ email: 'priya@demo.app', password: 'brandnew99' }));
    const old = await client().auth.signInWithPassword({ email: 'priya@demo.app', password: 'demo1234' });
    assert.match(old.error.message, /Invalid login credentials/);
  });

  await sam.removeChannel(channel);
  console.log(`✓ local backend contract: ${passed} checks passed`);
} finally {
  server.kill();
  rmSync(dir, { recursive: true, force: true });
}
process.exit(0);
