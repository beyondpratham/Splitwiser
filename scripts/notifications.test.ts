// Unit tests for notification wording (supabase/functions/_shared/messages.ts). Run with: npm test
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { buildMessage, emailHtml, money } from '../supabase/functions/_shared/messages.ts';

const ME = 'me';
const SAM = 'sam';
const dinner = {
  description: 'Dinner',
  amount: 1200,
  currency: 'INR',
  group_name: 'Goa Trip',
  shares: [
    { profile_id: SAM, paid: 1200, owed: 400 },
    { profile_id: ME, paid: 0, owed: 400 },
    { profile_id: 'priya', paid: 0, owed: 400 },
  ],
};

test('formats money with the right symbol', () => {
  assert.equal(money(1200, 'INR'), '₹1,200.00');
  assert.equal(money(9.5, 'USD'), '$9.50');
});

test('new expense says what you owe', () => {
  const m = buildMessage({ category: 'expenses', recipientId: ME, actorId: SAM, actorName: 'Sam Lee', activity: { kind: 'expense_added', group_id: 'g', expense_id: 'e1', data: { after: dinner } } });
  assert.equal(m.title, 'Dinner');
  assert.equal(m.body, 'Sam Lee added “Dinner” (₹1,200.00) in Goa Trip. You owe ₹400.00.');
  assert.equal(m.url, '/expense/e1');
});

test('the payer hears what they get back; deleted expenses skip the share', () => {
  const back = buildMessage({ category: 'expenses', recipientId: SAM, actorName: 'Priya', activity: { kind: 'expense_updated', group_id: null, expense_id: 'e1', data: { after: dinner } } });
  assert.match(back.body, /^Priya updated “Dinner”.*You get back ₹800\.00\.$/);
  const gone = buildMessage({ category: 'expenses', recipientId: ME, actorName: 'Sam', activity: { kind: 'expense_deleted', group_id: null, expense_id: 'e1', data: { before: dinner } } });
  assert.equal(gone.body, 'Sam deleted “Dinner” (₹1,200.00) in Goa Trip.');
});

test('payments, comments, friends, reminders and the weekly summary', () => {
  const pay = { description: 'Payment', amount: 500, currency: 'INR', is_payment: true, shares: [{ profile_id: SAM, paid: 500, owed: 0 }, { profile_id: ME, paid: 0, owed: 500 }] };
  const paid = buildMessage({ category: 'payments', recipientId: ME, actorName: 'Sam', activity: { kind: 'payment_added', group_id: null, expense_id: 'p1', data: { after: pay } } });
  assert.equal(paid.title, 'Sam paid you ₹500.00');

  const comment = buildMessage({ category: 'comments', recipientId: ME, actorName: 'Sam', activity: { kind: 'comment_added', group_id: null, expense_id: 'e1', data: { body: 'I’ll pay tomorrow', description: 'Dinner' } } });
  assert.deepEqual(comment, { title: 'Sam commented on “Dinner”', body: 'I’ll pay tomorrow', url: '/expense/e1' });

  const friend = buildMessage({ category: 'friends', recipientId: ME, actorId: SAM, actorName: 'Sam', data: { event: 'friend_added' } });
  assert.deepEqual(friend, { title: 'New friend', body: 'Sam added you as a friend on SplitWiser.', url: '/friend/sam' });
  const group = buildMessage({ category: 'friends', recipientId: ME, actorName: 'Sam', activity: { kind: 'member_added', group_id: 'g1', expense_id: null, data: { group_name: 'Flat 4B' } } });
  assert.equal(group.body, 'Sam added you to the group “Flat 4B”.');
  assert.equal(group.url, '/group/g1');

  const nudge = buildMessage({ category: 'reminders', recipientId: ME, actorId: SAM, actorName: 'Sam Lee', data: { owed: [{ currency: 'INR', amount: 400 }, { currency: 'USD', amount: 12 }] } });
  assert.equal(nudge.body, 'You owe Sam ₹400.00 + $12.00. Settle up whenever you’re ready.');

  const weekly = buildMessage({ category: 'weekly', recipientId: ME, data: { owed: [{ currency: 'INR', amount: 900 }], owe: [], new_expenses: 3 } });
  assert.equal(weekly.body, 'You’re owed ₹900.00. 3 new expenses this week.');
  assert.equal(buildMessage({ category: 'weekly', recipientId: ME, data: {} }).body, 'You’re all settled up.');
});

test('emails escape what people typed', () => {
  const html = emailHtml({ title: 'Sam commented', body: '<script>alert(1)</script>', url: '/' }, 'Alex Morgan');
  assert.ok(html.includes('&lt;script&gt;') && !html.includes('<script>'));
  assert.ok(html.includes('Hi Alex,'));
});
