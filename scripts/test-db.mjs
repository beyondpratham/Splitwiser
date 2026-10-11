// Runs the Supabase migrations against an in-memory Postgres (PGlite) with a minimal stub of
// Supabase's auth schema, then exercises the main flows as different users.
// Usage: npm run test:db
import { PGlite } from '@electric-sql/pglite';
import { readFileSync, readdirSync } from 'node:fs';
import assert from 'node:assert/strict';

const db = new PGlite();

await db.exec(`
  create role anon nologin; create role authenticated nologin;
  create schema auth;
  create table auth.users (id uuid primary key default gen_random_uuid(), email text, raw_user_meta_data jsonb default '{}');
  create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('test.uid', true), '')::uuid $$;
  create publication supabase_realtime;
  grant usage on schema public to anon, authenticated;
  grant usage on schema auth to anon, authenticated;
  grant execute on function auth.uid() to anon, authenticated;
  alter default privileges in schema public grant all on tables to anon, authenticated;
  alter default privileges in schema public grant all on functions to anon, authenticated;
`);

for (const file of readdirSync('supabase/migrations').sort()) {
  try { await db.exec(readFileSync(`supabase/migrations/${file}`, "utf8")); }
  catch (e) { console.error(`✗ ${file}: ${e.message}`, e.position ?? ''); process.exit(1); }
}

async function signUp(email, name) {
  const { rows } = await db.query(`insert into auth.users (email, raw_user_meta_data) values ($1, $2) returning id`, [email, { name }]);
  return rows[0].id;
}
async function as(uid, sql, params = []) {
  await db.exec(`reset role; select set_config('test.uid', '${uid}', false); set role authenticated;`);
  try { return (await db.query(sql, params)).rows; } finally { await db.exec('reset role;'); }
}
async function rejects(promise, re) {
  await assert.rejects(promise, (e) => re.test(e.message));
}

const alice = await signUp('alice@example.com', 'Alice');
const bob = await signUp('bob@example.com', 'Bob');
const [{ id: aliceP }] = await as(alice, 'select public.me() as id');
const [{ id: bobP }] = await as(bob, 'select public.me() as id');

// Alice adds Bob and a placeholder Carol, creates a group
await as(alice, `select public.add_friend('bob@example.com')`);
const [{ add_friend: carolP }] = await as(alice, `select public.add_friend('carol@example.com', 'Carol')`);
const [{ create_group: gid }] = await as(alice, `select public.create_group('Trip', '✈️', 'trip', 'USD', $1)`, [[bobP, carolP]]);
assert.equal((await as(bob, 'select * from public.groups')).length, 1, 'bob sees group');

// Alice pays 90, split equally 3 ways
const shares = (paidBy, owed) => [aliceP, bobP, carolP].map((p, i) => ({ profile_id: p, paid: p === paidBy ? 90 : 0, owed: owed[i] }));
const [{ save_expense: e1 }] = await as(alice, `select public.save_expense($1)`, [
  { group_id: gid, description: 'Hotel', amount: 90, currency: 'USD', category: 'lodging', split_type: 'equal', shares: shares(aliceP, [30, 30, 30]) },
]);
let bal = await as(alice, 'select * from public.my_balances order by balance');
assert.deepEqual(bal.map((b) => Number(b.balance)), [30, 30], 'alice is owed 30 by each');
bal = await as(bob, 'select * from public.my_balances');
assert.equal(Number(bal[0].balance), -30, 'bob owes alice 30');

// Bob pays 60 split 50/50 between Bob and Carol (percent)
await as(bob, `select public.save_expense($1)`, [{
  group_id: gid, description: 'Dinner', amount: 60, currency: 'USD', category: 'dining', split_type: 'percent',
  shares: [{ profile_id: bobP, paid: 60, owed: 30, split_value: 50 }, { profile_id: carolP, paid: 0, owed: 30, split_value: 50 }],
}]);
const gb = await as(alice, 'select profile_id, balance from public.group_balances where group_id = $1', [gid]);
const byP = Object.fromEntries(gb.map((r) => [r.profile_id, Number(r.balance)]));
assert.deepEqual([byP[aliceP], byP[bobP], byP[carolP]], [60, 0, -60], 'group nets');

// Validation
await rejects(as(alice, `select public.save_expense($1)`, [{ group_id: gid, description: 'Bad', amount: 10, shares: shares(aliceP, [1, 1, 1]) }]), /must add up/);

// Bob settles with Alice (payment)
await as(bob, `select public.save_expense($1)`, [{
  group_id: gid, description: 'Payment', amount: 30, is_payment: true,
  shares: [{ profile_id: bobP, paid: 30, owed: 0 }, { profile_id: aliceP, paid: 0, owed: 30 }],
}]);
bal = await as(bob, 'select * from public.my_balances where other_id = $1', [aliceP]);
assert.equal(bal.length, 0, 'bob settled with alice');

// Edit history + comments
await as(bob, `select public.save_expense($1)`, [{
  id: e1, group_id: gid, description: 'Hotel (2 nights)', amount: 90, category: 'lodging', shares: shares(aliceP, [30, 30, 30]),
}]);
await as(bob, `select public.add_comment($1, 'Thanks!')`, [e1]);
const act = await as(alice, `select kind from public.activity where expense_id = $1 order by created_at`, [e1]);
assert.deepEqual(act.map((a) => a.kind), ['expense_added', 'expense_updated', 'comment_added']);

// Carol signs up and claims her placeholder with all history
const carol = await signUp('Carol@Example.com', 'Carol K');
const [{ id: carolMe }] = await as(carol, 'select public.me() as id');
assert.equal(carolMe, carolP, 'placeholder claimed');
bal = await as(carol, 'select round(sum(balance), 2) as total from public.my_balances');
assert.equal(Number(bal[0].total), -60, 'carol owes 60 total');

// Outsiders see nothing, and cannot write directly
const dave = await signUp('dave@example.com', 'Dave');
assert.equal((await as(dave, 'select * from public.expenses')).length, 0);
assert.equal((await as(dave, 'select * from public.profiles')).length, 1, 'dave only sees himself');
await rejects(as(dave, `insert into public.groups (name) values ('x')`), /permission denied/);
await rejects(as(dave, `update public.profiles set email = 'alice@example.com'`), /permission denied/);
await rejects(as(dave, `select public.add_comment($1, 'hi')`, [e1]), /not found/);

// Delete + restore
await as(alice, `select public.delete_expense($1)`, [e1]);
assert.equal((await as(carol, 'select * from public.my_balances where other_id = $1', [aliceP])).length, 0, 'deleted expense ignored');
await as(alice, `select public.restore_expense($1)`, [e1]);
assert.equal((await as(carol, 'select * from public.my_balances where other_id = $1', [aliceP])).length, 1);

console.log('✓ all database checks passed');
