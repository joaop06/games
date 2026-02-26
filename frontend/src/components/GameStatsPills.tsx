type GameStatsPillsProps = {
  wins: number
  losses: number
  draws: number
  /** Se true, usa layout compacto (ex.: lista de amigos) */
  compact?: boolean
}

export default function GameStatsPills({ wins, losses, draws, compact = false }: GameStatsPillsProps) {
  const pillBase = {
    background: 'var(--bg-elevated)',
    borderRadius: 'var(--radius-md)',
    padding: compact ? 'var(--space-1) var(--space-2)' : 'var(--space-2) var(--space-3)',
    minWidth: compact ? undefined : 72,
    textAlign: 'center' as const,
  }

  const pills = [
    {
      label: 'Vitórias',
      value: wins,
      borderColor: 'var(--success)',
      color: 'var(--success)',
    },
    {
      label: 'Derrotas',
      value: losses,
      borderColor: 'var(--danger)',
      color: 'var(--danger)',
    },
    {
      label: 'Empates',
      value: draws,
      borderColor: 'var(--border)',
      color: 'var(--text-muted)',
    },
  ]

  const labelSize = compact ? 'var(--size-xs)' : 'var(--size-sm)'
  const valueSize = compact ? 'var(--size-sm)' : 'var(--size-base)'

  return (
    <div
      role="group"
      aria-label={`Estatísticas: ${wins} vitórias, ${losses} derrotas, ${draws} empates`}
      style={{
        display: 'flex',
        flexWrap: 'wrap',
        gap: 'var(--space-2)',
      }}
    >
      {pills.map(({ label, value, borderColor, color }) => (
        <div
          key={label}
          style={{
            ...pillBase,
            border: `1px solid ${borderColor}`,
            display: 'flex',
            flexDirection: compact ? 'row' : 'column',
            alignItems: 'center',
            gap: compact ? 'var(--space-1)' : 0,
          }}
        >
          <span
            style={{
              fontSize: labelSize,
              color: 'var(--text-muted)',
            }}
          >
            {label}
          </span>
          <span
            style={{
              fontSize: valueSize,
              fontWeight: 'var(--weight-bold)',
              color,
            }}
          >
            {value}
          </span>
        </div>
      ))}
    </div>
  )
}
