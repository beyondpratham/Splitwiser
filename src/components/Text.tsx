import { Text as RNText, type TextProps, type TextStyle } from 'react-native';
import { font, useTheme } from '@/theme';

const VARIANTS = {
  display: { fontFamily: font.bold, fontSize: 34, lineHeight: 40, letterSpacing: -0.8 },
  title: { fontFamily: font.bold, fontSize: 28, lineHeight: 34, letterSpacing: -0.5 },
  heading: { fontFamily: font.semibold, fontSize: 20, lineHeight: 26, letterSpacing: -0.2 },
  subhead: { fontFamily: font.semibold, fontSize: 17, lineHeight: 22, letterSpacing: -0.1 },
  body: { fontFamily: font.regular, fontSize: 16, lineHeight: 22 },
  bodyStrong: { fontFamily: font.medium, fontSize: 16, lineHeight: 22 },
  label: { fontFamily: font.medium, fontSize: 14, lineHeight: 19 },
  caption: { fontFamily: font.regular, fontSize: 13, lineHeight: 17 },
  overline: { fontFamily: font.semibold, fontSize: 12, lineHeight: 16, letterSpacing: 0.8, textTransform: 'uppercase' },
} satisfies Record<string, TextStyle>;

export type TextVariant = keyof typeof VARIANTS;
type Tone = 'ink' | 'dim' | 'faint' | 'accent' | 'owed' | 'owe' | 'danger' | 'onAccent';

export function T({
  variant = 'body',
  tone = 'ink',
  numeric,
  style,
  ...rest
}: TextProps & { variant?: TextVariant; tone?: Tone; numeric?: boolean }) {
  const t = useTheme();
  const color = {
    ink: t.ink,
    dim: t.inkDim,
    faint: t.inkFaint,
    accent: t.accentText,
    owed: t.owed,
    owe: t.owe,
    danger: t.danger,
    onAccent: t.accentInk,
  }[tone];
  return <RNText style={[VARIANTS[variant], { color }, numeric && { fontVariant: ['tabular-nums'] }, style]} {...rest} />;
}
