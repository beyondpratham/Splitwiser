// Unit tests for the money helpers. Run with: npm test
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { computeSplit, distribute, parseAmount, simplifyDebts, toMinor, fromMinor, currencyDecimals } from '../src/lib/money.ts';

test('distribute sums exactly and spreads remainders', () => {
  assert.deepEqual(distribute(1000, [1, 1, 1]), [334, 333, 333]);
  assert.deepEqual(distribute(100, [1, 1, 1, 1, 1, 1]).reduce((a, b) => a + b), 100);
  assert.deepEqual(distribute(1001, [2, 1]), [667, 334]);
  assert.deepEqual(distribute(500, [0, 0]), [0, 0]);
});

test('parseAmount handles common inputs', () => {
  assert.equal(parseAmount('12.50'), 12.5);
  assert.equal(parseAmount('1,234.56'), 1234.56);
  assert.equal(parseAmount('12,5'), 12.5);
  assert.equal(parseAmount(''), null);
  assert.equal(parseAmount('abc'), null);
  assert.equal(parseAmount('.'), null);
});

test('currency decimals', () => {
  assert.equal(currencyDecimals('USD'), 2);
  assert.equal(currencyDecimals('JPY'), 0);
  assert.equal(toMinor(1234, 'JPY'), 1234);
  assert.equal(toMinor(10.1, 'USD'), 1010);
  assert.equal(fromMinor(1010, 'USD'), 10.1);
});

test('equal split', () => {
  const r = computeSplit({ type: 'equal', totalMinor: 10000, values: [0, 0, 0] });
  assert.deepEqual(r.owed, [3334, 3333, 3333]);
  assert.equal(r.error, null);
});

test('percent split must total 100', () => {
  assert.equal(computeSplit({ type: 'percent', totalMinor: 10000, values: [50, 30] }).error, '20% left');
  assert.equal(computeSplit({ type: 'percent', totalMinor: 10000, values: [60, 50] }).error, '10% over');
  assert.deepEqual(computeSplit({ type: 'percent', totalMinor: 10000, values: [33.33, 33.33, 33.34] }).owed.reduce((a, b) => a + b), 10000);
});

test('shares split', () => {
  assert.deepEqual(computeSplit({ type: 'shares', totalMinor: 9000, values: [2, 1] }).owed, [6000, 3000]);
  assert.notEqual(computeSplit({ type: 'shares', totalMinor: 9000, values: [0, 0] }).error, null);
});

test('exact split reports remainder', () => {
  const r = computeSplit({ type: 'exact', totalMinor: 5000, values: [2000, 2000] });
  assert.equal(r.remainingMinor, 1000);
  assert.equal(r.error, 'left');
  assert.equal(computeSplit({ type: 'exact', totalMinor: 5000, values: [2500, 2500] }).error, null);
});

test('simplifyDebts minimises payments and conserves money', () => {
  // A is owed 60, B owes 30, C owes 30 -> two payments
  const tx = simplifyDebts({ A: 6000, B: -3000, C: -3000 });
  assert.equal(tx.length, 2);
  assert.ok(tx.every((t) => t.to === 'A'));
  // chain A->B->C collapses to A->C
  const chain = simplifyDebts({ A: -1000, B: 0, C: 1000 });
  assert.deepEqual(chain, [{ from: 'A', to: 'C', amount: 1000 }]);
  // conservation on a random case
  const nets = { a: 1234, b: -500, c: -734, d: 2000, e: -2000 };
  const out = simplifyDebts(nets);
  const after: Record<string, number> = { ...nets };
  for (const t of out) {
    after[t.from] += t.amount;
    after[t.to] -= t.amount;
  }
  assert.ok(Object.values(after).every((v) => v === 0));
  assert.ok(out.length <= Object.keys(nets).length - 1);
});
