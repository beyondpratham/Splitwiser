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
assert.equal((await as(dave, 'select id from public.profiles')).length, 1, 'dave only sees himself');
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

// Notifications: queued per person and type, by the channels each person picked
const nina = await signUp('nina@example.com', 'Nina');
const omar = await signUp('omar@example.com', 'Omar');
const [{ id: ninaP }] = await as(nina, 'select public.me() as id');
const [{ id: omarP }] = await as(omar, 'select public.me() as id');
const outbox = async (pid, category) =>
  (await db.query('select channels, actor_id, data from public.notification_outbox where profile_id = $1 and category = $2 order by id', [pid, category])).rows;
assert.equal((await as(omar, `select public.my_notification_prefs() ->> 'expenses' as v`))[0].v, 'push', 'default channel');
await as(nina, `select public.add_friend('omar@example.com')`);
assert.deepEqual((await outbox(omarP, 'friends')).map((r) => r.channels), [['push']], 'friend request notifies');
await as(nina, `select public.add_friend('omar@example.com')`);
assert.equal((await outbox(omarP, 'friends')).length, 1, 'adding again does not notify twice');
await as(omar, `select public.set_notification_pref('expenses', 'off')`);
await as(omar, `select public.set_notification_pref('comments', 'email')`);
await rejects(as(omar, `select public.set_notification_pref('expenses', 'sms')`), /unknown notification channel/);
await rejects(as(omar, `select public.set_notification_pref('passwords', 'push')`), /unknown notification type/);
const [{ save_expense: lunch }] = await as(nina, 'select public.save_expense($1)', [
  { description: 'Lunch', amount: 20, currency: 'USD', shares: [{ profile_id: ninaP, paid: 20, owed: 10 }, { profile_id: omarP, paid: 0, owed: 10 }] },
]);
assert.equal((await outbox(omarP, 'expenses')).length, 0, 'switched-off type is not queued');
assert.equal((await outbox(ninaP, 'expenses')).length, 0, 'nobody is notified about their own action');
await as(omar, `select public.add_comment($1, 'thanks!')`, [lunch]);
assert.deepEqual((await outbox(ninaP, 'comments')).map((r) => r.channels), [['push']], 'comment notifies the others');
await as(nina, `select public.add_comment($1, 'np')`, [lunch]);
assert.deepEqual((await outbox(omarP, 'comments')).map((r) => r.channels), [['email']], 'email-only choice respected');
await as(nina, 'select public.send_reminder($1)', [omarP]);
const [reminder] = await outbox(omarP, 'reminders');
assert.deepEqual(reminder.channels, ['push', 'email'], 'reminders default to push and email');
assert.deepEqual(reminder.data.owed, [{ currency: 'USD', amount: 10 }], 'reminder carries what is owed');
await rejects(as(nina, 'select public.send_reminder($1)', [omarP]), /already reminded/);
await rejects(as(omar, 'select public.send_reminder($1)', [ninaP]), /don’t owe you/);
await as(omar, `select public.save_expense($1)`, [{ description: 'Payment', amount: 10, currency: 'USD', is_payment: true, shares: [{ profile_id: omarP, paid: 10, owed: 0 }, { profile_id: ninaP, paid: 0, owed: 10 }] }]);
assert.deepEqual((await outbox(ninaP, 'payments')).map((r) => r.channels), [['push', 'email']], 'payments notify');
await as(omar, 'select public.register_push_token($1, $2)', ['ExponentPushToken[omar-device-1]', 'android']);
assert.equal((await db.query('select profile_id from public.push_tokens')).rows[0].profile_id, omarP, 'push token saved');
await as(nina, 'select public.register_push_token($1, $2)', ['ExponentPushToken[omar-device-1]', 'android']);
assert.equal((await db.query('select profile_id from public.push_tokens')).rows[0].profile_id, ninaP, 'token follows whoever signs in');
await rejects(as(omar, 'select * from public.push_tokens'), /permission denied/);
await rejects(as(omar, 'select * from public.notification_outbox'), /permission denied/);
await rejects(as(omar, 'select * from public.weekly_summaries()'), /permission denied/);
const weekly = (await db.query('select * from public.weekly_summaries() where profile_id = $1', [ninaP])).rows[0];
assert.deepEqual(weekly.channels, ['email'], 'weekly summary defaults to email');

// Phone numbers: private to their owner; finding someone by number can be switched off
await rejects(as(bob, 'select phone from public.profiles'), /permission denied/);
assert.equal((await as(alice, "select public.my_private_profile() ->> 'phone' as p"))[0].p, '+919876543210', 'you can read your own number');
assert.equal((await as(bob, 'select * from public.find_users_by_contacts($1, $2)', [['alice@example.com'], []]))[0].phone, null, 'matching by email does not reveal the number');
await as(alice, 'update public.profiles set phone_discoverable = false where id = $1', [aliceP]);
assert.equal((await as(bob, 'select * from public.find_users_by_contacts($1, $2)', [[], ['+919876543210']])).length, 0, 'hidden number does not match');
await rejects(as(bob, 'select public.add_friend_by_phone($1)', ['+919876543210']), /nobody on SplitWiser/);
await as(alice, 'update public.profiles set phone_discoverable = true where id = $1', [aliceP]);

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
