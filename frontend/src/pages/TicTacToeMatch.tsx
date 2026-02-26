import { useEffect, useState, useRef, useCallback } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { createTicTacToeWsClient } from '../api/ws'
import type { TicTacToeMatchState } from '../api/client'
import Board from '../components/tic-tac-toe/Board'
import Button from '../components/ui/Button'

const emptyState: TicTacToeMatchState = {
  id: '',
  gameType: 'tic_tac_toe',
  status: 'waiting',
  winnerId: null,
  playerX: undefined,
  playerO: null,
  board: [null, null, null, null, null, null, null, null, null],
  currentTurn: 'X',
  moves: [],
}

export default function TicTacToeMatch() {
  const { matchId } = useParams<{ matchId: string }>()
  const navigate = useNavigate()
  const { user } = useAuth()
  const [state, setState] = useState<TicTacToeMatchState>(emptyState)
  const [error, setError] = useState<string | null>(null)
  const [connecting, setConnecting] = useState(true)
  const wsRef = useRef<ReturnType<typeof createTicTacToeWsClient> | null>(null)

  const myRole: 'X' | 'O' | null =
    user && state.playerX?.id === user.id ? 'X' : user && state.playerO?.id === user.id ? 'O' : null

  const handleMessage = useCallback((msg: import('../api/ws').WsMessage) => {
    if (msg.type === 'match_state') {
      setState({
        id: msg.id,
        gameType: msg.gameType ?? 'tic_tac_toe',
        status: msg.status,
        winnerId: msg.winnerId ?? null,
        playerX: msg.playerX,
        playerO: msg.playerO ?? null,
        board: msg.board ?? emptyState.board,
        currentTurn: msg.currentTurn ?? 'X',
        moves: msg.moves ?? [],
      })
      setError(null)
    } else if (msg.type === 'error') {
      setError(msg.message ?? msg.code ?? 'Erro')
    }
  }, [])

  useEffect(() => {
    if (!matchId || !user?.id) return
    const ws = createTicTacToeWsClient()
    wsRef.current = ws
    ws
      .connect(handleMessage)
      .then(() => {
        ws.send({ type: 'join_match', matchId })
        setConnecting(false)
      })
      .catch((err) => {
        setError(err?.message ?? 'Falha ao conectar')
        setConnecting(false)
      })
    return () => {
      ws.disconnect()
      wsRef.current = null
    }
  }, [matchId, user, handleMessage])

  const handleCellClick = (position: number) => {
    const ws = wsRef.current
    if (!ws?.isConnected() || !matchId) return
    ws.send({ type: 'move', matchId, position })
  }

  const opponentName =
    myRole === 'X' ? (state.playerO?.username ?? 'Aguardando...') : (state.playerX?.username ?? 'Aguardando...')

  if (!matchId) {
    return (
      <div>
        <p>Partida não encontrada.</p>
        <Button variant="ghost" onClick={() => navigate('/games/tic-tac-toe')}>
          Voltar ao lobby
        </Button>
      </div>
    )
  }

  if (connecting) {
    return <p style={{ color: 'var(--text-muted)' }}>Conectando à partida...</p>
  }

  const isFinished = state.status === 'finished'
  const winnerName = state.winnerId
    ? state.playerX?.id === state.winnerId
      ? state.playerX?.username
      : state.playerO?.username
    : null

  return (
    <div>
      <div style={{ marginBottom: 'var(--space-4)', display: 'flex', alignItems: 'center', gap: 'var(--space-4)' }}>
        <Button variant="ghost" size="sm" onClick={() => navigate('/games/tic-tac-toe')}>
          ← Lobby
        </Button>
        <h1 style={{ fontFamily: 'var(--font-display)', margin: 0 }}>Jogo da Velha</h1>
      </div>

      {error && (
        <p style={{ color: 'var(--danger)', marginBottom: 'var(--space-3)' }} role="alert">
          {error}
        </p>
      )}

      <p style={{ color: 'var(--text-muted)', marginBottom: 'var(--space-4)' }}>
        {state.status === 'waiting' && 'Aguardando segundo jogador...'}
        {state.status === 'in_progress' &&
          !state.winnerId &&
          (myRole === state.currentTurn ? 'Sua vez!' : `Vez de ${opponentName}`)}
        {isFinished &&
          (state.winnerId
            ? state.winnerId === user?.id
              ? 'Você venceu!'
              : `${winnerName ?? 'Oponente'} venceu!`
            : 'Empate!')}
      </p>

      <Board
        board={state.board}
        currentTurn={state.currentTurn}
        status={state.status}
        winnerId={state.winnerId}
        myRole={myRole}
        onCellClick={handleCellClick}
        disabled={isFinished}
      />

      {isFinished && (
        <div style={{ marginTop: 'var(--space-5)' }}>
          <Button onClick={() => navigate('/games/tic-tac-toe')}>Nova partida</Button>
        </div>
      )}
    </div>
  )
}
