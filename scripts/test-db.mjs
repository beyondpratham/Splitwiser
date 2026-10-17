// Runs the Supabase migrations against an in-memory Postgres (PGlite) with a minimal stub of
// Supabase's auth schema, then exercises the main flows as different users.
// Usage: npm run test:db
import assert from 'node:assert/strict';
import { asUser, createUser, openDatabase } from './lib/local-db.mjs';

let db;
try {
  db = await openDatabase();
} catch (e) {
  console.error(`✗ ${e.message}`);
  process.exit(1);
}

const signUp = (email, name) => createUser(db, { email, name });
const as = (uid, sql, params = []) => asUser(db, uid, async (tx) => (await tx.query(sql, params)).rows);
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

// Phone numbers are unique, avatars and devices are per user
await as(alice, `update public.profiles set phone = '+919876543210', avatar = 'emoji:fox' where id = $1`, [aliceP]);
await rejects(as(bob, `update public.profiles set phone = '+919876543210' where id = $1`, [bobP]), /duplicate key|unique/);
await rejects(as(bob, `update public.profiles set phone = '12345' where id = $1`, [bobP]), /profiles_phone_format/);
await as(alice, `select public.claim_device('device-aaaaaaaa')`);
await as(alice, `select public.claim_device('device-bbbbbbbb')`);
assert.equal((await as(alice, 'select device_id from public.active_devices'))[0].device_id, 'device-bbbbbbbb', 'latest device wins');
assert.equal((await as(bob, 'select * from public.active_devices')).length, 0, 'devices are private');
const found = await as(bob, 'select * from public.find_users_by_contacts($1, $2)', [['nobody@x.com', 'ALICE@example.com'], ['+919876543210']]);
assert.deepEqual(found.map((r) => r.id), [aliceP], 'contacts match by email or phone, only real accounts');
assert.equal((await as(bob, 'select public.add_friend_by_phone($1) as id', ['+919876543210']))[0].id, aliceP);
await rejects(as(bob, 'select public.add_friend_by_phone($1)', ['+15550000000']), /nobody on SplitWiser/);

// Removing a friend: blocked while you share a group or owe each other, allowed once neither applies
await rejects(as(alice, 'select public.remove_friend($1)', [bobP]), /share a group|settle up/);
const zoe = await signUp('zoe@example.com', 'Zoe');
const [{ id: zoeP }] = await as(zoe, 'select public.me() as id');
await as(alice, `select public.add_friend('zoe@example.com')`);
await as(alice, `select public.save_expense($1)`, [{ description: 'Tea', amount: 4, currency: 'USD', shares: [{ profile_id: aliceP, paid: 4, owed: 2 }, { profile_id: zoeP, paid: 0, owed: 2 }] }]);
await rejects(as(alice, 'select public.remove_friend($1)', [zoeP]), /settle up/);
await as(zoe, `select public.save_expense($1)`, [{ description: 'Payment', amount: 2, currency: 'USD', is_payment: true, shares: [{ profile_id: zoeP, paid: 2, owed: 0 }, { profile_id: aliceP, paid: 0, owed: 2 }] }]);
await as(alice, 'select public.remove_friend($1)', [zoeP]);
assert.equal((await as(alice, 'select * from public.friendships where friend_id = $1', [zoeP])).length, 0, 'friendship removed');

// Account deletion: login gone, profile anonymized, shared history kept for the others
await as(dave, 'select public.delete_my_account()');
assert.equal((await db.query('select count(*)::int as n from auth.users where id = $1', [dave])).rows[0].n, 0, 'auth user removed');
await as(carol, `select public.add_comment($1, 'bye')`, [e1]);
await as(carol, 'select public.delete_my_account()');
const [ghost] = (await db.query('select name, email, user_id from public.profiles where id = $1', [carolP])).rows;
assert.deepEqual(ghost, { name: 'Deleted user', email: null, user_id: null }, 'profile anonymized');
assert.equal((await as(alice, 'select * from public.comments where author_id = $1', [carolP])).length, 0, 'comments removed');
assert.ok((await as(alice, 'select * from public.expense_shares where profile_id = $1', [carolP])).length > 0, 'shared history kept');
await rejects(as(null, 'select public.delete_my_account()'), /permission denied|not signed in/);

console.log('✓ all database checks passed');
