import { Platform } from 'react-native';

// LOCALIO — warm, modern, neighborhood-coded palette.
// Primary is a vibrant coral-orange; bg is a soft warm off-white (feels less
// clinical than pure #FFF); text is a warm near-black (not a cool gray).
export const theme = {
  colors: {
    primary: '#FF5A3C',
    primaryDark: '#D8401F',
    primarySoft: '#FFEDE7',     // tinted backgrounds / pill fills
    bg: '#FAF8F4',              // warm paper — replaces flat white
    surface: '#F2EFE8',         // cards / input backgrounds
    card: '#FFFFFF',            // elevated cards (pair with shadow.md)
    border: '#E8E4DB',
    borderStrong: '#D4CFC2',
    text: '#1C1A17',
    textMuted: '#6F6A62',
    success: '#16A34A',
    successSoft: '#DCFCE7',
    danger: '#DC2626',
    dangerSoft: '#FEE2E2',
    warning: '#D97706',
    warningSoft: '#FEF3C7',
    accent: '#0F766E',           // teal — complements warm primary
    accentSoft: '#CCFBF1',
    overlay: 'rgba(17, 15, 12, 0.45)',
  },
  radius: { sm: 8, md: 12, lg: 18, xl: 28, pill: 999 },
  spacing: (n: number) => n * 4,
  font: {
    // Use platform defaults — avoids a custom-font setup but still locks weights.
    family: Platform.select({ ios: 'System', android: 'sans-serif', default: 'System' }) as string,
    weight: {
      regular: '400' as const,
      medium: '500' as const,
      semibold: '600' as const,
      bold: '700' as const,
      extrabold: '800' as const,
      black: '900' as const,
    },
    size: { xs: 11, sm: 13, base: 15, md: 16, lg: 18, xl: 22, xxl: 28, display: 34 },
  },
  shadow: {
    sm: {
      shadowColor: '#1C1A17',
      shadowOpacity: 0.06,
      shadowRadius: 4,
      shadowOffset: { width: 0, height: 1 },
      elevation: 1,
    },
    md: {
      shadowColor: '#1C1A17',
      shadowOpacity: 0.08,
      shadowRadius: 10,
      shadowOffset: { width: 0, height: 3 },
      elevation: 3,
    },
    lg: {
      shadowColor: '#1C1A17',
      shadowOpacity: 0.12,
      shadowRadius: 20,
      shadowOffset: { width: 0, height: 8 },
      elevation: 6,
    },
  },
};
