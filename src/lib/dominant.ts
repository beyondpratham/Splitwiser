// The most prominent colour of a picture, for colouring the profile QR code.
import jpeg from 'jpeg-js';

function hsv(r: number, g: number, b: number) {
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const d = max - min;
  let h = 0;
  if (d) {
    if (max === r) h = ((g - b) / d) % 6;
    else if (max === g) h = (b - r) / d + 2;
    else h = (r - g) / d + 4;
  }
  return { h: (h * 60 + 360) % 360, s: max ? d / max : 0, v: max / 255 };
}

/**
 * Groups pixels by hue (ignoring greys, near-whites and near-blacks), weights each by how vivid it is,
 * and returns the average colour of the strongest hue group as #rrggbb. Null for colourless pictures.
 */
export function prominentFromPixels(data: Uint8Array | number[], channels = 4): string | null {
  const buckets = Array.from({ length: 12 }, () => ({ w: 0, r: 0, g: 0, b: 0 }));
  for (let i = 0; i + 2 < data.length; i += channels) {
    const [r, g, b] = [data[i], data[i + 1], data[i + 2]];
    const { h, s, v } = hsv(r, g, b);
    if (s < 0.2 || v < 0.15 || v > 0.98) continue;
    const w = s * v;
    const k = Math.floor(h / 30) % 12;
    buckets[k].w += w;
    buckets[k].r += r * w;
    buckets[k].g += g * w;
    buckets[k].b += b * w;
  }
  const best = buckets.reduce((a, b) => (b.w > a.w ? b : a));
  if (best.w < 0.5) return null;
  const hex = (c: number) => Math.round(c / best.w).toString(16).padStart(2, '0');
  return `#${hex(best.r)}${hex(best.g)}${hex(best.b)}`;
}

/** Decodes a small base64 JPEG and finds its prominent colour. */
export function prominentFromJpegBase64(base64: string): string | null {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  const { data } = jpeg.decode(bytes, { useTArray: true, formatAsRGBA: true });
  return prominentFromPixels(data, 4);
}
