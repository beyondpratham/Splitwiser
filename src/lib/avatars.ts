// Preset avatars. A profile's `avatar` is either `emoji:<id>` (one of these), a small `data:` photo,
// or empty (initials on the profile colour).

export interface PresetAvatar {
  id: string;
  emoji: string;
  bg: string;
}

export const AVATARS: PresetAvatar[] = [
  { id: 'fox', emoji: '🦊', bg: '#FDE2CC' },
  { id: 'panda', emoji: '🐼', bg: '#E4E7EA' },
  { id: 'koala', emoji: '🐨', bg: '#DCE3EE' },
  { id: 'lion', emoji: '🦁', bg: '#FCEBC2' },
  { id: 'tiger', emoji: '🐯', bg: '#FFE0B8' },
  { id: 'frog', emoji: '🐸', bg: '#D6F2D4' },
  { id: 'monkey', emoji: '🐵', bg: '#EFDCCB' },
  { id: 'penguin', emoji: '🐧', bg: '#D9E9F7' },
  { id: 'owl', emoji: '🦉', bg: '#E9DFD2' },
  { id: 'octopus', emoji: '🐙', bg: '#F8D9E3' },
  { id: 'unicorn', emoji: '🦄', bg: '#EADCF7' },
  { id: 'whale', emoji: '🐳', bg: '#D3EDF6' },
  { id: 'cat', emoji: '🐱', bg: '#FBE7C8' },
  { id: 'dog', emoji: '🐶', bg: '#F1E3D3' },
  { id: 'bear', emoji: '🐻', bg: '#EBDACB' },
  { id: 'chick', emoji: '🐥', bg: '#FFF2B8' },
];

export function presetFor(avatar: string | null | undefined): PresetAvatar | null {
  if (!avatar?.startsWith('emoji:')) return null;
  return AVATARS.find((a) => a.id === avatar.slice(6)) ?? null;
}

export const isPhoto = (avatar: string | null | undefined) => !!avatar && (avatar.startsWith('data:') || avatar.startsWith('http'));
