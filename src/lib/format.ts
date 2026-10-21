export const money = (v: number | null, compact = false) =>
  v === null
    ? 'Unavailable'
    : new Intl.NumberFormat('en-US', {
        style: 'currency',
        currency: 'USD',
        notation: compact ? 'compact' : 'standard',
        maximumFractionDigits: compact ? 2 : v < 0.01 ? 8 : v < 1 ? 4 : 2,
      }).format(v);
export const number = (v: number | null) =>
  v === null
    ? 'Unavailable'
    : new Intl.NumberFormat('en-US', { notation: 'compact', maximumFractionDigits: 2 }).format(v);
export const percent = (v: number | null) =>
  v === null ? 'Unavailable' : `${v > 0 ? '+' : ''}${v.toFixed(2)}%`;
export const timestamp = (v: string | null) =>
  v
    ? new Intl.DateTimeFormat('en-US', {
        month: 'short',
        day: 'numeric',
        hour: 'numeric',
        minute: '2-digit',
        timeZoneName: 'short',
      }).format(new Date(v))
    : 'Timestamp unavailable';
