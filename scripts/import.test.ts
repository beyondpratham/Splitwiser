// Unit tests for the Splitwise CSV importer. Run with: npm test
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { parseCsv, parseSplitwiseExport, sharesFromNets } from '../src/lib/splitwise-import.ts';

const SAMPLE = `Date,Description,Category,Cost,Currency,Alex Morgan,Sam Lee,Priya Shah

2026-09-16,"Beach villa, 3 nights",Hotel,24000.00,INR,14400.00,-7200.00,-7200.00
2026-09-17,Cocktails,Drinks,1800.00,INR,-400.00,-700.00,1100.00
2026-09-23,Settle all balances,Payment,5000.00,INR,-5000.00,0.00,5000.00

2026-10-17,Total balance, , ,INR,9000.00,-7900.00,-1100.00
`;

test('parses quoted CSV fields', () => {
  assert.deepEqual(parseCsv('a,"b, c","d ""e"""\n1,2,3'), [
    ['a', 'b, c', 'd "e"'],
    ['1', '2', '3'],
  ]);
});

test('reads a Splitwise export, skipping the total row', () => {
  const p = parseSplitwiseExport(SAMPLE);
  assert.deepEqual(p.people, ['Alex Morgan', 'Sam Lee', 'Priya Shah']);
  assert.equal(p.rows.length, 3);
  assert.equal(p.rows[0].description, 'Beach villa, 3 nights');
  assert.equal(p.rows[0].category, 'lodging');
  assert.equal(p.rows[2].isPayment, true);
  assert.deepEqual(p.currencies, ['INR']);
});

test('rejects files that are not Splitwise exports', () => {
  assert.throws(() => parseSplitwiseExport('name,amount\nx,1'), /Splitwise export/);
});

test('rebuilds paid/owed so the nets and totals match exactly', () => {
  for (const [cost, nets] of [
    [2400000, [1440000, -720000, -720000]], // one payer
    [180000, [-40000, -70000, 110000]], // payer also owes a share
    [500000, [-500000, 0, 500000]], // payment
    [10000, [3334, 3333, -6667]], // two payers
  ] as [number, number[]][]) {
    const shares = sharesFromNets(cost, nets);
    assert.equal(shares.reduce((s, x) => s + x.paid, 0), cost, 'paid adds up');
    assert.equal(shares.reduce((s, x) => s + x.owed, 0), cost, 'owed adds up');
    shares.forEach((x, i) => assert.equal(x.paid - x.owed, nets[i], 'net preserved'));
  }
});

// ── prominent colour (used to colour the QR code from the profile photo) ──
import jpeg from 'jpeg-js';
import { prominentFromJpegBase64, prominentFromPixels } from '../src/lib/dominant.ts';

test('finds the vivid colour and ignores greys', () => {
  // 60% grey pixels, 40% strong blue
  const px: number[] = [];
  for (let i = 0; i < 60; i++) px.push(128, 128, 128, 255);
  for (let i = 0; i < 40; i++) px.push(20, 90, 220, 255);
  assert.equal(prominentFromPixels(px), '#145adc');
  assert.equal(prominentFromPixels([200, 200, 200, 255, 10, 10, 10, 255]), null);
});

test('decodes a JPEG photo and picks its colour', () => {
  const w = 16;
  const h = 16;
  const data = new Uint8Array(w * h * 4);
  for (let i = 0; i < w * h; i++) data.set(i < 64 ? [240, 240, 240, 255] : [230, 80, 20, 255], i * 4);
  const encoded = jpeg.encode({ data, width: w, height: h }, 90).data;
  const color = prominentFromJpegBase64(Buffer.from(encoded).toString('base64'))!;
  const [r, g, b] = [1, 3, 5].map((i) => parseInt(color.slice(i, i + 2), 16));
  assert.ok(r > 190 && g < 120 && b < 60, `expected orange, got ${color}`);
});
