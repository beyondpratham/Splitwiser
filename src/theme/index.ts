import { MD3DarkTheme, MD3LightTheme, useTheme as usePaperTheme, type MD3Theme } from 'react-native-paper';
import { darkColors, lightColors, type SchemeColors } from './palette';

function build(base: MD3Theme, c: SchemeColors) {
  return {
    ...base,
    roundness: 4,
    colors: {
      ...base.colors,
      ...c,
      // Material 3 tonal elevation maps onto the surface-container roles.
      elevation: {
        level0: 'transparent',
        level1: c.surfaceContainerLow,
        level2: c.surfaceContainer,
        level3: c.surfaceContainerHigh,
        level4: c.surfaceContainerHigh,
        level5: c.surfaceContainerHighest,
      },
      surfaceDisabled: hexAlpha(c.onSurface, 0.12),
      onSurfaceDisabled: hexAlpha(c.onSurface, 0.38),
      backdrop: hexAlpha(c.scrim, 0.32),
    },
  };
}

export function hexAlpha(hex: string, alpha: number) {
  const a = Math.round(alpha * 255).toString(16).padStart(2, '0');
  return `${hex}${a}`;
}

export const lightTheme = build(MD3LightTheme, lightColors);
export const darkTheme = build(MD3DarkTheme, darkColors);
export type AppTheme = typeof lightTheme;

export const useTheme = () => usePaperTheme<AppTheme>();

export const space = { xs: 4, sm: 8, md: 12, lg: 16, xl: 24, xxl: 32 };

/** Material 3 shape scale. */
export const shape = { xs: 4, sm: 8, md: 12, lg: 16, xl: 28, full: 999 };

/** Material 3 expressive motion springs, for Reanimated's withSpring. */
export const motion = {
  fast: { dampingRatio: 0.9, duration: 250 },
  standard: { dampingRatio: 0.85, duration: 420 },
  bouncy: { dampingRatio: 0.65, duration: 550 },
} as const;
