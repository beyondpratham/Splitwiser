import QR from 'qrcode';
import { useMemo } from 'react';
import Svg, { Path, Rect } from 'react-native-svg';

/** A QR code drawn as one SVG path (crisp at any size). */
export function QrCode({ value, size, color = '#0E1A14', background = '#FFFFFF' }: { value: string; size: number; color?: string; background?: string }) {
  const { path, count } = useMemo(() => {
    const qr = QR.create(value, { errorCorrectionLevel: 'M' });
    const n = qr.modules.size;
    let d = '';
    for (let y = 0; y < n; y++) {
      for (let x = 0; x < n; x++) {
        if (qr.modules.get(x, y)) d += `M${x} ${y}h1v1h-1z`;
      }
    }
    return { path: d, count: n };
  }, [value]);
  const quiet = 2; // white margin, in modules
  const box = count + quiet * 2;
  return (
    <Svg width={size} height={size} viewBox={`${-quiet} ${-quiet} ${box} ${box}`} accessibilityLabel="QR code">
      <Rect x={-quiet} y={-quiet} width={box} height={box} fill={background} />
      <Path d={path} fill={color} />
    </Svg>
  );
}

/** What a SplitWiser profile QR encodes. Scanning it in Add friend adds that person. */
export function profileQrValue(p: { email: string | null; name: string; phone?: string | null }) {
  const params = new URLSearchParams();
  if (p.email) params.set('e', p.email);
  if (p.phone) params.set('p', p.phone);
  params.set('n', p.name);
  return `splitwiser://add?${params.toString()}`;
}

/** Reads a scanned code; returns null when it isn't a SplitWiser profile QR. */
export function parseProfileQr(data: string): { email?: string; phone?: string; name?: string } | null {
  if (!data.startsWith('splitwiser://add?')) return null;
  const params = new URLSearchParams(data.slice('splitwiser://add?'.length));
  const email = params.get('e') ?? undefined;
  const phone = params.get('p') ?? undefined;
  if (!email && !phone) return null;
  return { email, phone, name: params.get('n') ?? undefined };
}
