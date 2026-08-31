export type StatusKind = 'root' | 'selected' | 'moved' | 'changed'

const STATUS = {
  root: { symbol: '★', label: 'ROOT' },
  selected: { symbol: '●', label: 'SELECTED' },
  moved: { symbol: '↪', label: 'MOVED' },
  changed: { symbol: 'Δ', label: 'CHANGED' },
} as const

interface StatusBadgeProps {
  status: StatusKind
}

export function StatusBadge({ status }: StatusBadgeProps) {
  const { symbol, label } = STATUS[status]

  return (
    <span className={`status-badge status-badge--${status}`} aria-label={label}>
      <span aria-hidden="true">{symbol}</span>
      <span>{label}</span>
    </span>
  )
}
