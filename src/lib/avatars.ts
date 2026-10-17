// Preset avatars. A profile's `avatar` is either `emoji:<id>` (one of these), a small `data:` photo,
// or empty (initials on the profile colour).

export interface PresetAvatar {
  id: string;
  emoji: string;
  bg: string;
  /** vivid colour of the avatar, used for the QR code and as the profile colour */
  ink: string;
}

export const AVATARS: PresetAvatar[] = [
  { id: 'fox', emoji: '🦊', bg: '#FDE2CC', ink: '#E8590C' },
  { id: 'panda', emoji: '🐼', bg: '#E4E7EA', ink: '#495057' },
  { id: 'koala', emoji: '🐨', bg: '#DCE3EE', ink: '#5F6B7A' },
  { id: 'lion', emoji: '🦁', bg: '#FCEBC2', ink: '#D9900B' },
  { id: 'tiger', emoji: '🐯', bg: '#FFE0B8', ink: '#F76707' },
  { id: 'frog', emoji: '🐸', bg: '#D6F2D4', ink: '#2F9E44' },
  { id: 'monkey', emoji: '🐵', bg: '#EFDCCB', ink: '#8B5E3C' },
  { id: 'penguin', emoji: '🐧', bg: '#D9E9F7', ink: '#1C7ED6' },
  { id: 'owl', emoji: '🦉', bg: '#E9DFD2', ink: '#8D6E63' },
  { id: 'octopus', emoji: '🐙', bg: '#F8D9E3', ink: '#D6336C' },
  { id: 'unicorn', emoji: '🦄', bg: '#EADCF7', ink: '#9C36B5' },
  { id: 'whale', emoji: '🐳', bg: '#D3EDF6', ink: '#1098AD' },
  { id: 'cat', emoji: '🐱', bg: '#FBE7C8', ink: '#E67700' },
  { id: 'dog', emoji: '🐶', bg: '#F1E3D3', ink: '#A0522D' },
  { id: 'bear', emoji: '🐻', bg: '#EBDACB', ink: '#7B4B2A' },
  { id: 'chick', emoji: '🐥', bg: '#FFF2B8', ink: '#E8A10B' },
];

export function presetFor(avatar: string | null | undefined): PresetAvatar | null {
  if (!avatar?.startsWith('emoji:')) return null;
  return AVATARS.find((a) => a.id === avatar.slice(6)) ?? null;
}

export const isPhoto = (avatar: string | null | undefined) => !!avatar && (avatar.startsWith('data:') || avatar.startsWith('http'));

function luminance(hex: string) {
  const [r, g, b] = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255).map((c) => (c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4));
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

function darken(hex: string, amount: number) {
  const n = [1, 3, 5].map((i) => Math.round(parseInt(hex.slice(i, i + 2), 16) * (1 - amount)));
  return `#${n.map((c) => c.toString(16).padStart(2, '0')).join('')}`;
}

/** The QR code colour: the picture's prominent colour, darkened until it scans reliably on white. */
export function qrColor(profile: { avatar: string | null; avatar_color: string }) {
  let color = presetFor(profile.avatar)?.ink ?? profile.avatar_color;
  if (!/^#[0-9a-fA-F]{6}$/.test(color)) return '#0E1A14';
  for (let i = 0; i < 10 && luminance(color) > 0.12; i++) color = darken(color, 0.15);
  return color;
}
