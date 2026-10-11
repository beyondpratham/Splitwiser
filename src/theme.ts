import { useColorScheme } from 'react-native';

// Mirrors Apple's system palette so the app feels native in light and dark mode.
const light = {
  background: '#F2F2F7', // systemGroupedBackground
  card: '#FFFFFF', // secondarySystemGroupedBackground
  elevated: '#FFFFFF',
  fill: 'rgba(120,120,128,0.12)', // tertiarySystemFill
  text: '#000000',
  secondary: 'rgba(60,60,67,0.6)',
  tertiary: 'rgba(60,60,67,0.3)',
  separator: 'rgba(60,60,67,0.18)',
  accent: '#10A66B',
  accentSoft: 'rgba(16,166,107,0.12)',
  owed: '#10A66B', // you are owed
  owe: '#F2690D', // you owe
  oweSoft: 'rgba(242,105,13,0.12)',
  danger: '#FF3B30',
  onAccent: '#FFFFFF',
};

const dark: typeof light = {
  background: '#000000',
  card: '#1C1C1E',
  elevated: '#2C2C2E',
  fill: 'rgba(118,118,128,0.24)',
  text: '#FFFFFF',
  secondary: 'rgba(235,235,245,0.6)',
  tertiary: 'rgba(235,235,245,0.3)',
  separator: 'rgba(84,84,88,0.6)',
  accent: '#2FD08C',
  accentSoft: 'rgba(47,208,140,0.16)',
  owed: '#2FD08C',
  owe: '#FF8A3D',
  oweSoft: 'rgba(255,138,61,0.16)',
  danger: '#FF453A',
  onAccent: '#00140B',
};

export type Theme = typeof light;

export function useTheme(): Theme {
  return useColorScheme() === 'dark' ? dark : light;
}

export const radius = { sm: 8, md: 12, lg: 16, xl: 22 };
export const space = { xs: 4, sm: 8, md: 12, lg: 16, xl: 24, xxl: 32 };
