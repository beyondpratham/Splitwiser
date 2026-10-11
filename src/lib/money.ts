// All arithmetic is done in integer minor units (cents) to avoid floating point drift.

export type SplitType = 'equal' | 'exact' | 'percent' | 'shares';

const decimalsCache = new Map<string, number>();

export function currencyDecimals(currency: string): number {
  let d = decimalsCache.get(currency);
  if (d === undefined) {
    try {
      d = new Intl.NumberFormat('en', { style: 'currency', currency }).resolvedOptions().maximumFractionDigits ?? 2;
    } catch {
      d = 2;
    }
    decimalsCache.set(currency, d);
  }
  return d;
}

export function toMinor(amount: number | string, currency: string): number {
  const n = typeof amount === 'string' ? parseAmount(amount) : amount;
  return Math.round((n ?? 0) * 10 ** currencyDecimals(currency));
}

export function fromMinor(minor: number, currency: string): number {
  return minor / 10 ** currencyDecimals(currency);
}

/** Parses user input like "1,234.50" or "12,5" into a number, or null when invalid. */
export function parseAmount(input: string): number | null {
  const s = input.trim().replace(/\s/g, '');
  if (!s) return null;
  // treat a lone comma followed by 1-2 digits at the end as a decimal separator
  const normalized = /,\d{1,2}$/.test(s) && !s.includes('.') ? s.replace(',', '.') : s.replace(/,/g, '');
  if (!/^\d*\.?\d*$/.test(normalized) || normalized === '.') return null;
  const n = Number(normalized);
  return Number.isFinite(n) ? n : null;
}

export function formatMoney(amount: number, currency: string, opts: { signed?: boolean; compact?: boolean } = {}): string {
  const d = currencyDecimals(currency);
  try {
    return new Intl.NumberFormat(undefined, {
      style: 'currency',
      currency,
      signDisplay: opts.signed ? 'exceptZero' : 'auto',
      notation: opts.compact ? 'compact' : 'standard',
      minimumFractionDigits: opts.compact ? 0 : d,
      maximumFractionDigits: d,
    }).format(amount);
  } catch {
    return `${currency} ${amount.toFixed(d)}`;
  }
}

/** Distributes `total` minor units across `weights`, using largest-remainder so the parts sum exactly. */
export function distribute(total: number, weights: number[]): number[] {
  const sum = weights.reduce((a, b) => a + b, 0);
  if (sum <= 0) return weights.map(() => 0);
  const raw = weights.map((w) => (total * w) / sum);
  const parts = raw.map(Math.floor);
  let remainder = total - parts.reduce((a, b) => a + b, 0);
  const order = raw
    .map((r, i) => ({ i, frac: r - Math.floor(r) }))
    .sort((a, b) => b.frac - a.frac || a.i - b.i);
  for (let k = 0; remainder > 0 && k < order.length; k++, remainder--) parts[order[k].i] += 1;
  return parts;
}

export interface SplitInput {
  type: SplitType;
  totalMinor: number;
  /** per participant raw value: ignored for equal; minor units for exact; percent; share count */
  values: number[];
}

export interface SplitResult {
  owed: number[]; // minor units
  error: string | null;
  remainingMinor: number; // for exact: how much is left to assign
  remainingPercent: number;
}

export function computeSplit({ type, totalMinor, values }: SplitInput): SplitResult {
  const n = values.length;
  const ok = (owed: number[]): SplitResult => ({ owed, error: null, remainingMinor: 0, remainingPercent: 0 });
  if (n === 0) return { owed: [], error: 'Choose at least one person', remainingMinor: totalMinor, remainingPercent: 100 };

  switch (type) {
    case 'equal':
      return ok(distribute(totalMinor, values.map(() => 1)));
    case 'shares': {
      if (values.some((v) => v < 0)) return { ...ok(values.map(() => 0)), error: 'Shares cannot be negative' };
      if (values.reduce((a, b) => a + b, 0) <= 0) return { ...ok(values.map(() => 0)), error: 'Add at least one share' };
      return ok(distribute(totalMinor, values));
    }
    case 'percent': {
      const sum = values.reduce((a, b) => a + b, 0);
      const remainingPercent = Math.round((100 - sum) * 1000) / 1000;
      if (Math.abs(remainingPercent) > 0.001) {
        return { owed: distribute(Math.round((totalMinor * sum) / 100), values), error: remainingPercent > 0 ? `${remainingPercent}% left` : `${-remainingPercent}% over`, remainingMinor: 0, remainingPercent };
      }
      return ok(distribute(totalMinor, values));
    }
    case 'exact': {
      const sum = values.reduce((a, b) => a + b, 0);
      const remainingMinor = totalMinor - sum;
      return { owed: values, error: remainingMinor === 0 ? null : remainingMinor > 0 ? 'left' : 'over', remainingMinor, remainingPercent: 0 };
    }
  }
}

export interface Transfer {
  from: string;
  to: string;
  amount: number; // minor units
}

/**
 * Minimises the number of payments needed to settle a set of net balances.
 * `nets`: positive = is owed, negative = owes (minor units). Greedy largest-first matching.
 */
export function simplifyDebts(nets: Record<string, number>): Transfer[] {
  const creditors = Object.entries(nets).filter(([, v]) => v > 0).map(([id, v]) => ({ id, v }));
  const debtors = Object.entries(nets).filter(([, v]) => v < 0).map(([id, v]) => ({ id, v: -v }));
  const out: Transfer[] = [];
  while (creditors.length && debtors.length) {
    creditors.sort((a, b) => b.v - a.v);
    debtors.sort((a, b) => b.v - a.v);
    const c = creditors[0];
    const d = debtors[0];
    const amount = Math.min(c.v, d.v);
    if (amount > 0) out.push({ from: d.id, to: c.id, amount });
    c.v -= amount;
    d.v -= amount;
    if (c.v === 0) creditors.shift();
    if (d.v === 0) debtors.shift();
  }
  return out;
}
