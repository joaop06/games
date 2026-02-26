import type { TicTacToeBoard } from '../../api/client'

type BoardProps = {
  board: TicTacToeBoard
  currentTurn: 'X' | 'O'
  status: string
  winnerId: string | null
  myRole: 'X' | 'O' | null
  onCellClick: (position: number) => void
  disabled?: boolean
}

const cellStyle: React.CSSProperties = {
  aspectRatio: '1',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  fontSize: 'clamp(2rem, 8vw, 4rem)',
  fontWeight: 700,
  background: 'var(--bg-elevated)',
  border: '2px solid var(--border)',
  borderRadius: 'var(--radius-md)',
  cursor: 'pointer',
  transition: 'background var(--transition-fast), border-color var(--transition-fast), color var(--transition-fast)',
}

export default function Board({
  board,
  currentTurn,
  status,
  winnerId,
  myRole,
  onCellClick,
  disabled = false,
}: BoardProps) {
  const isMyTurn = myRole && status === 'in_progress' && currentTurn === myRole && !winnerId

  return (
    <div style={{ maxWidth: 320, margin: '0 auto' }}>
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: '1fr 1fr 1fr',
          gap: 'var(--space-2)',
        }}
      >
        {board.map((cell, i) => {
          const isFilled = cell !== null
          const canClick = isMyTurn && !isFilled && !disabled
          return (
            <button
              key={i}
              type="button"
              aria-label={cell ? `Casa ${i + 1}: ${cell}` : `Casa ${i + 1} vazia`}
              disabled={!canClick}
              style={{
                ...cellStyle,
                cursor: canClick ? 'pointer' : 'default',
                color: cell === 'X' ? 'var(--accent)' : cell === 'O' ? 'var(--success)' : 'var(--text-muted)',
              }}
              onClick={() => canClick && onCellClick(i)}
            >
              {cell ?? ''}
            </button>
          )
        })}
      </div>
    </div>
  )
}
