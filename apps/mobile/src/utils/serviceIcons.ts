export interface ServiceIcon {
  icon: string;
  bg: string;
  fg: string;
}

const MAP: Record<string, ServiceIcon> = {
  plumber:    { icon: '🚿', bg: '#E3F2FD', fg: '#0B79D0' },
  electrician:{ icon: '💡', bg: '#FFF8E1', fg: '#E6A800' },
  carpenter:  { icon: '🔨', bg: '#EFEBE9', fg: '#8D6E63' },
  doctor:     { icon: '🩺', bg: '#E8F5E9', fg: '#2E7D32' },
  tutor:      { icon: '📚', bg: '#E3F2FD', fg: '#1565C0' },
  maid:       { icon: '🧹', bg: '#F3E5F5', fg: '#6A1B9A' },
  tiffin:     { icon: '🍱', bg: '#FFF3E0', fg: '#E65100' },
  mechanic:   { icon: '🔧', bg: '#ECEFF1', fg: '#455A64' },
  beauty:     { icon: '💅', bg: '#FCE4EC', fg: '#C2185B' },
  pet:        { icon: '🐾', bg: '#FFF3E0', fg: '#BF360C' },
  pharmacy:   { icon: '💊', bg: '#E0F7FA', fg: '#00838F' },
  other:      { icon: '🧰', bg: '#F5F5F5', fg: '#616161' },
};

export function serviceIcon(key?: string | null): ServiceIcon {
  return MAP[key ?? ''] ?? MAP.other;
}
