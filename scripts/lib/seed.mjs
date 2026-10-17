// Demo data for the local backend. Everything goes through the real RPCs as each user, so it
// exercises the same rules (RLS, validation, activity) the app does.
import { asUser, createUser } from './local-db.mjs';

const PASSWORD = 'demo1234';

function daysAgo(n) {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return d.toISOString().slice(0, 10);
}

/** Splits `total` evenly in cents across ids (remainder to the first people). */
function equal(total, ids) {
  const cents = Math.round(total * 100);
  const base = Math.floor(cents / ids.length);
  return Object.fromEntries(ids.map((id, i) => [id, (base + (i < cents - base * ids.length ? 1 : 0)) / 100]));
}

export async function seedDemoData(db, { hashPassword }) {
  const rpc = (uid, fn, args) =>
    asUser(db, uid, async (tx) => {
      const keys = Object.keys(args);
      const sql = `select public.${fn}(${keys.map((k, i) => `${k} => $${i + 1}`).join(', ')}) as r`;
      return (await tx.query(sql, keys.map((k) => args[k]))).rows[0]?.r;
    });
  const profileOf = async (uid) => (await db.query('select id from public.profiles where user_id = $1', [uid])).rows[0].id;

  const people = {};
  for (const [key, name] of [['alex', 'Alex Morgan'], ['sam', 'Sam Lee'], ['priya', 'Priya Shah'], ['jordan', 'Jordan Kim']]) {
    const uid = await createUser(db, { email: `${key}@demo.app`, name, passwordHash: hashPassword(PASSWORD) });
    people[key] = { uid, pid: await profileOf(uid) };
  }
  const { alex, sam, priya, jordan } = people;
  await db.query(`update public.profiles set avatar_color = c.color from (values
    ($1::uuid, '#10A66B'), ($2::uuid, '#1E88E5'), ($3::uuid, '#D81B60'), ($4::uuid, '#F4511E')) as c(id, color) where profiles.id = c.id`,
  [alex.pid, sam.pid, priya.pid, jordan.pid]);
  await db.query(`update public.profiles set default_currency = 'USD'`);
  await db.query(`update public.profiles set avatar = c.avatar from (values
    ($1::uuid, 'emoji:fox'), ($2::uuid, 'emoji:panda'), ($3::uuid, 'emoji:owl'), ($4::uuid, 'emoji:lion')) as c(id, avatar) where profiles.id = c.id`,
  [alex.pid, sam.pid, priya.pid, jordan.pid]);
  await db.query(`update public.profiles set phone = '+919876500001' where id = $1`, [alex.pid]);

  for (const p of [sam, priya, jordan]) await rpc(alex.uid, 'add_friend', { friend_email: (await db.query('select email from public.profiles where id = $1', [p.pid])).rows[0].email });
  const chris = await rpc(alex.uid, 'add_friend', { friend_email: 'chris@demo.app', friend_name: 'Chris Park' });

  const flat = await rpc(alex.uid, 'create_group', { group_name: 'Flat 4B', group_emoji: '🏠', group_kind: 'home', currency: 'USD', member_ids: [sam.pid, jordan.pid] });
  const trip = await rpc(alex.uid, 'create_group', { group_name: 'Goa Trip', group_emoji: '🏖️', group_kind: 'trip', currency: 'INR', member_ids: [sam.pid, priya.pid] });

  const expense = (actor, e) =>
    rpc(actor.uid, 'save_expense', {
      payload: {
        group_id: e.group ?? null,
        description: e.desc,
        amount: e.amount,
        currency: e.cur,
        category: e.cat ?? 'general',
        split_type: e.split ?? 'equal',
        is_payment: e.payment ?? false,
        spent_on: e.on,
        notes: e.notes ?? null,
        shares: Object.keys({ ...e.paid, ...e.owed }).map((pid) => ({
          profile_id: pid,
          paid: e.paid[pid] ?? 0,
          owed: e.owed[pid] ?? 0,
          split_value: e.values?.[pid] ?? null,
        })),
      },
    });

  // ── Flat 4B: five months of shared bills ──
  const flatmates = [alex.pid, sam.pid, jordan.pid];
  const groceryPayers = [jordan, alex, sam];
  let groceriesToEdit = null;
  for (let m = 4; m >= 0; m--) {
    const base = m * 30;
    const landlordPayer = [alex, sam, jordan][m % 3]; // whoever's turn it is pays the landlord
    await expense(landlordPayer, { group: flat, desc: 'Rent', amount: 2400, cur: 'USD', cat: 'rent', on: daysAgo(base + 2), paid: { [landlordPayer.pid]: 2400 }, owed: equal(2400, flatmates) });
    const power = [96.4, 112.8, 131.25, 104.6, 88.9][m];
    await expense(sam, { group: flat, desc: 'Electricity bill', amount: power, cur: 'USD', cat: 'utilities', on: daysAgo(base + 6), paid: { [sam.pid]: power }, owed: equal(power, flatmates) });
    await expense(jordan, { group: flat, desc: 'Internet', amount: 60, cur: 'USD', cat: 'internet', on: daysAgo(base + 9), paid: { [jordan.pid]: 60 }, owed: equal(60, flatmates) });
    for (let k = 0; k < 2; k++) {
      const amt = [142.37, 87.15, 118.6, 64.2, 156.9, 95.45, 73.8, 129.99, 110.4, 81.25][m * 2 + k];
      const payer = groceryPayers[(m + k) % 3];
      const id = await expense(payer, { group: flat, desc: k ? 'Costco run' : 'Groceries', amount: amt, cur: 'USD', cat: 'groceries', on: daysAgo(base + 4 + k * 11), paid: { [payer.pid]: amt }, owed: equal(amt, flatmates) });
      if (m === 0 && k === 0) groceriesToEdit = { id, payer, amt };
    }
  }
  await expense(alex, {
    group: flat, desc: 'Cleaning supplies', amount: 48, cur: 'USD', cat: 'household', split: 'shares', on: daysAgo(12),
    paid: { [alex.pid]: 48 }, owed: { [alex.pid]: 24, [sam.pid]: 12, [jordan.pid]: 12 }, values: { [alex.pid]: 2, [sam.pid]: 1, [jordan.pid]: 1 },
  });
  await expense(sam, { group: flat, desc: 'Payment', amount: 300, cur: 'USD', cat: 'payment', split: 'exact', payment: true, on: daysAgo(8), paid: { [sam.pid]: 300 }, owed: { [alex.pid]: 300 } });

  // ── Goa Trip, in rupees ──
  const trio = [alex.pid, sam.pid, priya.pid];
  await expense(priya, { group: trip, desc: 'Flights to Goa', amount: 18600, cur: 'INR', cat: 'flights', on: daysAgo(26), paid: { [priya.pid]: 18600 }, owed: equal(18600, trio) });
  const hotel = await expense(alex, {
    group: trip, desc: 'Beach villa (3 nights)', amount: 24000, cur: 'INR', cat: 'lodging', split: 'percent', on: daysAgo(25),
    paid: { [alex.pid]: 24000 }, owed: { [alex.pid]: 9600, [sam.pid]: 7200, [priya.pid]: 7200 }, values: { [alex.pid]: 40, [sam.pid]: 30, [priya.pid]: 30 },
    notes: 'Alex took the room with the sea view.',
  });
  await expense(sam, { group: trip, desc: 'Dinner at the beach shack', amount: 3450, cur: 'INR', cat: 'dining', on: daysAgo(25), paid: { [sam.pid]: 3450 }, owed: equal(3450, trio) });
  await expense(alex, { group: trip, desc: 'Scooter rental', amount: 2100, cur: 'INR', cat: 'transport', on: daysAgo(24), paid: { [alex.pid]: 1000, [sam.pid]: 1100 }, owed: equal(2100, trio) });
  await expense(priya, {
    group: trip, desc: 'Cocktails', amount: 1800, cur: 'INR', cat: 'drinks', split: 'exact', on: daysAgo(24),
    paid: { [priya.pid]: 1800 }, owed: { [alex.pid]: 400, [sam.pid]: 700, [priya.pid]: 700 },
  });
  await expense(alex, { group: trip, desc: 'Airport taxi', amount: 950, cur: 'INR', cat: 'taxi', on: daysAgo(23), paid: { [alex.pid]: 950 }, owed: equal(950, trio) });
  await expense(priya, { group: trip, desc: 'Payment', amount: 5000, cur: 'INR', cat: 'payment', split: 'exact', payment: true, on: daysAgo(18), paid: { [priya.pid]: 5000 }, owed: { [alex.pid]: 5000 } });

  // ── Outside any group ──
  const coffee = await expense(alex, { desc: 'Coffee & croissants', amount: 18.5, cur: 'USD', cat: 'coffee', on: daysAgo(3), paid: { [alex.pid]: 18.5 }, owed: equal(18.5, [alex.pid, chris]) });
  await expense(priya, { desc: 'Movie tickets', amount: 32, cur: 'USD', cat: 'entertainment', on: daysAgo(5), paid: { [priya.pid]: 32 }, owed: equal(32, [alex.pid, priya.pid]) });

  // ── Conversation and history ──
  await rpc(sam.uid, 'add_comment', { eid: hotel, comment_body: 'Best stay ever 🌴 worth every rupee' });
  await rpc(alex.uid, 'add_comment', { eid: hotel, comment_body: 'Agreed! Booking it again next year.' });
  await rpc(priya.uid, 'add_comment', { eid: hotel, comment_body: 'Count me in 🙌' });
  await rpc(alex.uid, 'add_comment', { eid: coffee, comment_body: 'Your treat next time, Chris!' });
  if (groceriesToEdit) {
    // An edit, so the expense has history to show.
    const { id, payer, amt } = groceriesToEdit;
    const fixed = Math.round((amt + 12.4) * 100) / 100;
    await rpc(payer.uid, 'save_expense', {
      payload: {
        id, group_id: flat, description: 'Groceries + snacks', amount: fixed, currency: 'USD', category: 'groceries', split_type: 'equal', spent_on: daysAgo(4),
        shares: Object.entries(equal(fixed, flatmates)).map(([pid, owed]) => ({ profile_id: pid, paid: pid === payer.pid ? fixed : 0, owed })),
      },
    });
  }

  // Backdate timestamps so the activity feed and insights read naturally.
  await db.exec(`
    update public.expenses set created_at = spent_on + time '19:00' + (random() * interval '3 hours'), updated_at = spent_on + time '19:00' + (random() * interval '3 hours');
    update public.activity a set created_at = e.created_at + (case when a.kind = 'expense_updated' then interval '1 day' else interval '0' end)
      from public.expenses e where a.expense_id = e.id and a.kind in ('expense_added', 'payment_added', 'expense_updated');
    update public.comments c set created_at = e.created_at + interval '2 hours' + (random() * interval '20 hours') from public.expenses e where c.expense_id = e.id;
    update public.activity a set created_at = c.created_at from public.comments c
      where a.kind = 'comment_added' and a.expense_id = c.expense_id and a.data->>'body' = left(c.body, 140);
    update public.activity set created_at = now() - interval '150 days' where kind in ('group_created', 'member_added');
  `);
}
