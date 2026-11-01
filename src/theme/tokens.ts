// Bright, playful palette with chunky "3D" shadows (each color has a darker edge).
export const palette = {
  green: '#58CC02',
  greenEdge: '#46A302',
  blue: '#1CB0F6',
  blueEdge: '#1899D6',
  red: '#FF4B4B',
  redEdge: '#EA2B2B',
  orange: '#FF9600',
  orangeEdge: '#E08600',
  yellow: '#FFC800',
  yellowEdge: '#E5B400',
  purple: '#CE82FF',
  purpleEdge: '#A568CC',
  white: '#FFFFFF',
};

export type ThemeColors = {
  bg: string;
  surface: string;
  surfaceAlt: string;
  border: string;
  text: string;
  textMuted: string;
  primary: string;
  primaryEdge: string;
  primarySoft: string;
  income: string;
  expense: string;
  warning: string;
  info: string;
  infoEdge: string;
  danger: string;
  dangerEdge: string;
  streak: string;
  xp: string;
  tabInactive: string;
};

export const lightColors: ThemeColors = {
  bg: '#FFFFFF',
  surface: '#FFFFFF',
  surfaceAlt: '#F7F7F7',
  border: '#E5E5E5',
  text: '#3C3C3C',
  textMuted: '#777777',
  primary: palette.green,
  primaryEdge: palette.greenEdge,
  primarySoft: '#D7FFB8',
  income: '#3FA600',
  expense: palette.red,
  warning: palette.orange,
  info: palette.blue,
  infoEdge: palette.blueEdge,
  danger: palette.red,
  dangerEdge: palette.redEdge,
  streak: palette.orange,
  xp: palette.yellow,
  tabInactive: '#AFAFAF',
};

export const darkColors: ThemeColors = {
  bg: '#131F24',
  surface: '#131F24',
  surfaceAlt: '#202F36',
  border: '#37464F',
  text: '#F1F7FB',
  textMuted: '#8FA3AD',
  primary: palette.green,
  primaryEdge: palette.greenEdge,
  primarySoft: '#1E3A12',
  income: '#79D634',
  expense: '#FF6B6B',
  warning: palette.orange,
  info: palette.blue,
  infoEdge: palette.blueEdge,
  danger: palette.red,
  dangerEdge: palette.redEdge,
  streak: palette.orange,
  xp: palette.yellow,
  tabInactive: '#52656D',
};

export const fonts = {
  regular: 'Nunito_600SemiBold',
  bold: 'Nunito_700Bold',
  heavy: 'Nunito_800ExtraBold',
  black: 'Nunito_900Black',
};

export const radius = { sm: 10, md: 16, lg: 22, pill: 999 };
export const space = { xs: 4, sm: 8, md: 12, lg: 16, xl: 24, xxl: 32 };

/** Category/account swatches users can pick from */
export const swatches = [
  '#58CC02', '#1CB0F6', '#FF9600', '#FF4B4B', '#CE82FF',
  '#FFC800', '#00CD9C', '#FF86D0', '#2B70C9', '#AFAFAF',
];

/** Darkens a hex color — used to derive the 3D edge of arbitrary colors. */
export function shade(hex: string, amount = 0.18): string {
  const n = parseInt(hex.slice(1), 16);
  const f = (c: number) => Math.max(0, Math.round(c * (1 - amount)));
  const r = f(n >> 16), g = f((n >> 8) & 0xff), b = f(n & 0xff);
  return `#${((r << 16) | (g << 8) | b).toString(16).padStart(6, '0')}`;
}

/** Hex color with alpha, e.g. tint('#58CC02', 0.15) */
export function tint(hex: string, alpha: number): string {
  return hex + Math.round(alpha * 255).toString(16).padStart(2, '0');
}
