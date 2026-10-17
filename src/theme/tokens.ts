// Design tokens. The glass values mirror the liquid-glass component in the Personal-Portfolio project
// (landing.css `.lg`): a translucent tint, a rim that is bright on top and dark on the flanks,
// a top sheen and a soft drop shadow.

export const light = {
  dark: false,
  // surfaces
  bg: '#E7E7E4', // grey-white, so glass stands off it
  bgGlow: 'rgba(16,166,107,0.16)',
  bgGlow2: 'rgba(255,255,255,0.75)',
  solid: '#F4F4F2', // opaque fallback for sheets/dialog bodies
  // ink
  ink: '#121212',
  inkDim: '#5E5E5E',
  inkFaint: '#9C9C9C',
  line: 'rgba(18,18,18,0.08)',
  // brand + meaning
  accent: '#10A66B',
  accentInk: '#FFFFFF',
  accentText: '#0A8556',
  accentSoft: 'rgba(16,166,107,0.14)',
  owed: '#0A8556',
  owe: '#C2571E',
  oweSoft: 'rgba(194,87,30,0.12)',
  danger: '#D23B3B',
  dangerSoft: 'rgba(210,59,59,0.10)',
  // glass
  glassTint: 'rgba(255,255,255,0.42)',
  glassStrong: 'rgba(255,255,255,0.66)',
  glassPressed: 'rgba(255,255,255,0.28)',
  rimTop: 'rgba(255,255,255,0.95)',
  rimSide: 'rgba(255,255,255,0.55)',
  rimBottom: 'rgba(0,0,0,0.07)',
  sheen: 'rgba(255,255,255,0.60)',
  sheenDiag: 'rgba(255,255,255,0.20)',
  drop: 'rgba(0,0,0,0.22)',
  scrim: 'rgba(18,18,18,0.28)',
  blurTint: 'light' as 'light' | 'dark',
};

export const dark: typeof light = {
  dark: true,
  bg: '#000000',
  bgGlow: 'rgba(47,208,140,0.14)',
  bgGlow2: 'rgba(255,255,255,0.05)',
  solid: '#141416',
  ink: '#FFFFFF',
  inkDim: '#9E9E9E',
  inkFaint: '#5C5C5C',
  line: 'rgba(255,255,255,0.10)',
  accent: '#2FD08C',
  accentInk: '#00140B',
  accentText: '#45DA9B',
  accentSoft: 'rgba(47,208,140,0.16)',
  owed: '#45DA9B',
  owe: '#FF9B5C',
  oweSoft: 'rgba(255,155,92,0.14)',
  danger: '#FF6B6B',
  dangerSoft: 'rgba(255,107,107,0.14)',
  glassTint: 'rgba(40,40,44,0.42)',
  glassStrong: 'rgba(40,40,44,0.70)',
  glassPressed: 'rgba(60,60,66,0.55)',
  rimTop: 'rgba(255,255,255,0.30)',
  rimSide: 'rgba(255,255,255,0.09)',
  rimBottom: 'rgba(255,255,255,0.05)',
  sheen: 'rgba(255,255,255,0.08)',
  sheenDiag: 'rgba(255,255,255,0.06)',
  drop: 'rgba(0,0,0,0.90)',
  scrim: 'rgba(0,0,0,0.55)',
  blurTint: 'dark',
};

export type Tokens = typeof light;

export const space = { xs: 4, sm: 8, md: 12, lg: 16, xl: 24, xxl: 32 };
export const radius = { sm: 12, md: 18, lg: 24, xl: 28, pane: 32, pill: 999 };

export const font = {
  regular: 'Inter_400Regular',
  medium: 'Inter_500Medium',
  semibold: 'Inter_600SemiBold',
  bold: 'Inter_700Bold',
};

/** Spring presets for Reanimated's withSpring. */
export const motion = {
  press: { damping: 18, stiffness: 420, mass: 0.6 },
  snappy: { dampingRatio: 0.85, duration: 320 },
  smooth: { dampingRatio: 0.9, duration: 450 },
  bouncy: { dampingRatio: 0.68, duration: 520 },
} as const;

/** `#RRGGBB` + alpha → `#RRGGBBAA`. */
export function withAlpha(hex: string, alpha: number) {
  return `${hex}${Math.round(alpha * 255).toString(16).padStart(2, '0')}`;
}
