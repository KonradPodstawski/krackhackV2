export function formatNumber(value: number | null | undefined): string {
  if (value == null || Number.isNaN(value)) {
    return '—';
  }

  return new Intl.NumberFormat('pl-PL').format(value);
}

export function formatHours(value: number | null | undefined): string {
  if (value == null || Number.isNaN(value)) {
    return '—';
  }

  return `${value.toFixed(1)} h`;
}

export function formatPercent(value: number | null | undefined): string {
  if (value == null || Number.isNaN(value)) {
    return '—';
  }

  return `${value.toFixed(1)}%`;
}

export function formatShortDate(label: string): string {
  return label;
}

export function clampText(value: string, max = 80): string {
  if (value.length <= max) {
    return value;
  }

  return `${value.slice(0, max - 1)}…`;
}
