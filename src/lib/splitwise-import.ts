// Turns a Splitwise group export (CSV) into SplitWiser expenses.
// Splitwise exports: Date,Description,Category,Cost,Currency,<Person A>,<Person B>,…
// where each person's column is their net change for that row (positive = paid more than their share).
import { guessCategory } from './categories.ts';
import { distribute } from './money.ts';

export interface ImportRow {
  date: string; // YYYY-MM-DD
  description: string;
  category: string;
  cost: number;
  currency: string;
  isPayment: boolean;
  nets: number[]; // per person, same order as `people`
}

export interface ParsedExport {
  people: string[];
  rows: ImportRow[];
  currencies: string[];
}

/** Minimal CSV parser that understands quoted fields and doubled quotes. */
export function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = '';
  let quoted = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (quoted) {
      if (c === '"' && text[i + 1] === '"') {
        field += '"';
        i++;
      } else if (c === '"') quoted = false;
      else field += c;
    } else if (c === '"') quoted = true;
    else if (c === ',') {
      row.push(field);
      field = '';
    } else if (c === '\n' || c === '\r') {
      if (c === '\r' && text[i + 1] === '\n') i++;
      row.push(field);
      rows.push(row);
      row = [];
      field = '';
    } else field += c;
  }
  if (field || row.length) {
    row.push(field);
    rows.push(row);
  }
  return rows.filter((r) => r.some((f) => f.trim()));
}

export function parseSplitwiseExport(text: string): ParsedExport {
  const table = parseCsv(text.replace(/^﻿/, ''));
  const headerIndex = table.findIndex((r) => r[0]?.trim().toLowerCase() === 'date' && r[3]?.trim().toLowerCase() === 'cost');
  if (headerIndex < 0) throw new Error('This doesn’t look like a Splitwise export. In Splitwise, open the group → Settings → Export as spreadsheet.');
  const header = table[headerIndex];
  const people = header.slice(5).map((p) => p.trim()).filter(Boolean);
  if (people.length < 2) throw new Error('The export needs at least two people.');

  const rows: ImportRow[] = [];
  for (const r of table.slice(headerIndex + 1)) {
    const date = r[0]?.trim();
    if (!date || !/^\d{4}-\d{2}-\d{2}/.test(date)) continue; // skips "Total balance" and notes
    const cost = Math.abs(Number(r[3]));
    if (!cost) continue;
    const category = r[2]?.trim() ?? '';
    const description = r[1]?.trim() || 'Expense';
    rows.push({
      date: date.slice(0, 10),
      description,
      category: guessCategory(`${description} ${category}`) ?? 'general',
      cost,
      currency: (r[4]?.trim() || 'USD').toUpperCase(),
      isPayment: category.toLowerCase() === 'payment',
      nets: people.map((_, i) => Number(r[5 + i] || 0)),
    });
  }
  if (!rows.length) throw new Error('No expenses found in this file.');
  return { people, rows, currencies: [...new Set(rows.map((r) => r.currency))] };
}

/**
 * Rebuilds who paid and who owed from Splitwise's net columns (in cents, exact):
 * negative nets owe that amount; the rest of the cost is shared by the people with positive nets,
 * whose payment is their net plus that share.
 */
export function sharesFromNets(costCents: number, netCents: number[]): { paid: number; owed: number }[] {
  const owedByNegatives = netCents.reduce((s, n) => s + (n < 0 ? -n : 0), 0);
  const positives = netCents.map((n, i) => (n > 0 ? i : -1)).filter((i) => i >= 0);
  const rest = Math.max(0, costCents - owedByNegatives);
  const restParts = positives.length ? distribute(rest, positives.map(() => 1)) : [];
  return netCents.map((n, i) => {
    if (n < 0) return { paid: 0, owed: -n };
    const k = positives.indexOf(i);
    if (k < 0) return { paid: 0, owed: 0 };
    return { paid: n + restParts[k], owed: restParts[k] };
  });
}
