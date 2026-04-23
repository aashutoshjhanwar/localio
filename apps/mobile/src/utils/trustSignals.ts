export function formatResponseTime(mins: number | null | undefined): string | null {
  if (mins == null) return null;
  if (mins < 5) return 'Replies instantly';
  if (mins < 60) return `Replies in ~${Math.round(mins / 5) * 5}m`;
  const h = Math.round(mins / 60);
  if (h <= 24) return `Replies in ~${h}h`;
  return 'Replies in a day+';
}

export function formatLastActive(iso: string | null | undefined): string | null {
  if (!iso) return null;
  const diffMs = Date.now() - new Date(iso).getTime();
  if (diffMs < 10 * 60 * 1000) return 'Active now';
  if (diffMs < 3600 * 1000) return `Active ${Math.round(diffMs / 60000)}m ago`;
  if (diffMs < 24 * 3600 * 1000) return `Active ${Math.round(diffMs / 3600000)}h ago`;
  if (diffMs < 7 * 24 * 3600 * 1000) return `Active ${Math.round(diffMs / (24 * 3600000))}d ago`;
  return null;
}
