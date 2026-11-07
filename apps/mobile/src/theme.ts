import { Platform } from 'react-native';

export const palettes = {
  light: {
    canvas: '#f4f5f7',
    paper: '#ffffff',
    ink: '#26282e',
    muted: '#7c808c',
    line: '#e3e5eb',
    soft: '#e9edf7',
    accent: '#485c8a',
    searchPlaceholder: '#a2a6b2',
    overlay: '#fffffff2',
    danger: '#b04444',
    editorShadow: '0 5px 24px #25263012',
    aiBlue: '#8199e5',
    aiRose: '#d299c3',
    aiAmber: '#d9b58a',
  },
  dark: {
    canvas: '#0d0d0f',
    paper: '#18181b',
    ink: '#e7e7ec',
    muted: '#94949f',
    line: '#29292e',
    soft: '#24242b',
    accent: '#babacb',
    searchPlaceholder: '#73737e',
    overlay: '#18181bf2',
    danger: '#eb999d',
    editorShadow: '0 5px 24px #00000040',
    aiBlue: '#8f9ff2',
    aiRose: '#d193c8',
    aiAmber: '#d4aa75',
  },
};
export type Palette = typeof palettes.light;
export const space = { xs: 4, sm: 8, md: 12, lg: 20, xl: 28, xxl: 40 } as const;
export const radius = { sm: 12, card: 20, group: 24, pill: 99 } as const;
export const fonts = {
  editorial: Platform.select({ ios: 'Georgia', android: 'serif', default: 'Georgia' }),
  mono: Platform.select({ ios: 'Menlo', default: 'monospace' }),
};
export const type = {
  hero: { fontSize: 42, lineHeight: 46, letterSpacing: -1.8, fontFamily: fonts.editorial },
  title: { fontSize: 28, lineHeight: 34, letterSpacing: -0.8, fontWeight: '500' as const },
  body: { fontSize: 16, lineHeight: 25 },
  small: { fontSize: 13, lineHeight: 19 },
  caption: { fontSize: 11, lineHeight: 16, letterSpacing: 0.2 },
};
