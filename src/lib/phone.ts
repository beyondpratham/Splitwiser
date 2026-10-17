/** "+91 98765-43210", "9876543210", "0091…" → "+919876543210" (India by default), or null if unusable. */
export function normalizePhone(input: string): string | null {
  let s = input.replace(/[\s\-().]/g, '');
  if (!s) return null;
  if (s.startsWith('00')) s = `+${s.slice(2)}`;
  if (!s.startsWith('+')) s = s.length === 10 ? `+91${s}` : `+${s}`;
  return /^\+[1-9]\d{6,14}$/.test(s) ? s : null;
}
