// Design tokens. The glass values mirror the liquid-glass component in the Personal-Portfolio project
// (landing.css `.lg`): a translucent tint, a rim that is bright on top and dark on the flanks,
// a top sheen and a soft drop shadow.

export const light = {
  dark: false,
  // surfaces: solid very light green
  bg: '#E8F5EC',
  solid: '#F4FBF6', // opaque fallback for sheets/dialog bodies
  // ink
  ink: '#0E1A14',
  inkDim: '#4E6158',
  inkFaint: '#8FA399',
  line: 'rgba(14,60,38,0.09)',
  // brand + meaning
  accent: '#10A66B',
  accentInk: '#FFFFFF',
  accentText: '#0A8556',
  accentSoft: 'rgba(16,166,107,0.13)',
  owed: '#0A8556',
  owe: '#C2571E',
  oweSoft: 'rgba(194,87,30,0.12)',
  danger: '#D23B3B',
  dangerSoft: 'rgba(210,59,59,0.10)',
  // glass
  glassTint: 'rgba(255,255,255,0.58)',
  glassStrong: 'rgba(255,255,255,0.82)',
  glassPressed: 'rgba(16,166,107,0.08)',
  rimTop: 'rgba(255,255,255,0.95)',
  rimSide: 'rgba(255,255,255,0.6)',
  rimBottom: 'rgba(14,60,38,0.08)',
  sheen: 'rgba(255,255,255,0.65)',
  sheenDiag: 'rgba(255,255,255,0.22)',
  drop: 'rgba(14,70,44,0.20)',
  scrim: 'rgba(8,32,22,0.30)',
  blurTint: 'light' as 'light' | 'dark',
};

export const dark: typeof light = {
  dark: true,
  // surfaces: solid deep green
  bg: '#0A1F17',
  solid: '#10291F',
  ink: '#F2FBF6',
  inkDim: '#9DB7AA',
  inkFaint: '#5F7A6D',
  line: 'rgba(255,255,255,0.08)',
  accent: '#2FD08C',
  accentInk: '#03170E',
  accentText: '#4EDDA0',
  accentSoft: 'rgba(47,208,140,0.15)',
  owed: '#4EDDA0',
  owe: '#FF9B5C',
  oweSoft: 'rgba(255,155,92,0.14)',
  danger: '#FF6B6B',
  dangerSoft: 'rgba(255,107,107,0.14)',
  glassTint: 'rgba(255,255,255,0.06)',
  glassStrong: 'rgba(16,44,33,0.92)',
  glassPressed: 'rgba(255,255,255,0.08)',
  rimTop: 'rgba(255,255,255,0.20)',
  rimSide: 'rgba(255,255,255,0.07)',
  rimBottom: 'rgba(0,0,0,0.25)',
  sheen: 'rgba(255,255,255,0.07)',
  sheenDiag: 'rgba(255,255,255,0.04)',
  drop: 'rgba(0,0,0,0.55)',
  scrim: 'rgba(0,8,5,0.60)',
  blurTint: 'dark',
};

export type Tokens = typeof light;

export const space = { xs: 4, sm: 8, md: 12, lg: 16, xl: 24, xxl: 32 };
/** One corner radius for every card, button, field, chip and sheet: slightly rounder than a rectangle. */
export const R = 14;
export const radius = { sm: R, md: R, lg: R, xl: R, pane: R, pill: R };

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
