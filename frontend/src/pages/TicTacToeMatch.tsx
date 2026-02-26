import { useEffect, useState, useCallback } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { useRealtime } from '../context/RealtimeContext'
import { api, type TicTacToeMatchState } from '../api/client'
import { getUserMessage } from '../lib/userMessages'
import Board from '../components/tic-tac-toe/Board'
import { Alert, Button } from '../components/ui'

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
  const { connection, subscribe, isConnected, showToast } = useRealtime()
  const [state, setState] = useState<TicTacToeMatchState>(emptyState)
  const [error, setError] = useState<string | null>(null)
  const [connecting, setConnecting] = useState(true)
  const [rematchLoading, setRematchLoading] = useState(false)
  const [friendIds, setFriendIds] = useState<Set<string>>(new Set())
  const [addFriendStatus, setAddFriendStatus] = useState<'idle' | 'loading' | 'sent' | 'already_friends'>('idle')

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
      setConnecting(false)
    } else if (msg.type === 'error') {
      setError(getUserMessage(msg.message ?? msg.code ?? ''))
      setConnecting(false)
    }
  }, [])

  useEffect(() => {
    if (!matchId) return
    const unsub = subscribe(handleMessage)
    return () => {
      unsub()
      connection.send({ type: 'leave_match' })
    }
  }, [matchId, subscribe, handleMessage, connection])

  useEffect(() => {
    if (matchId && isConnected) {
      connection.send({ type: 'join_match', matchId })
    }
  }, [matchId, isConnected, connection])

  const handleCellClick = (position: number) => {
    if (!connection.isConnected() || !matchId) return
    connection.send({ type: 'move', matchId, position })
  }

  const opponentName =
    myRole === 'X' ? (state.playerO?.username ?? 'Aguardando...') : (state.playerX?.username ?? 'Aguardando...')

  const opponent = state.playerX && state.playerO && user
    ? (state.playerX.id === user.id ? state.playerO : state.playerX)
    : null

  useEffect(() => {
    if (state.status !== 'finished' || !opponent?.id) return
    api.getFriends().then((res) => {
      setFriendIds(new Set(res.friends.map((f) => f.id)))
    }).catch(() => {})
  }, [state.status, opponent?.id])

  const handleAddFriend = async () => {
    if (!opponent?.username) return
    setAddFriendStatus('loading')
    setError(null)
    try {
      await api.inviteFriend(opponent.username)
      setAddFriendStatus('sent')
    } catch (e: unknown) {
      const msg = (e instanceof Error ? e.message : '') || ''
      if (msg.includes('Already friends') || msg.includes('já são amigos')) {
        setAddFriendStatus('already_friends')
      } else if (msg.includes('Invite already sent') || msg.includes('Convite já enviado')) {
        setAddFriendStatus('sent')
      } else {
        setError(getUserMessage(msg) || 'Não foi possível enviar convite.')
        setAddFriendStatus('idle')
      }
    }
  }

  const handleNewMatch = async () => {
    if (!opponent?.id) {
      navigate('/games/tic-tac-toe')
      return
    }
    setRematchLoading(true)
    setError(null)
    try {
      const res = await api.createTicTacToeMatch(opponent.id)
      if (res.opponentBusy) {
        showToast({
          type: 'game_invite_opponent_busy',
          username: opponent.username ?? 'Oponente',
        })
        return
      }
      if (res.match) {
        navigate(`/games/tic-tac-toe/match/${res.match.id}`)
      }
    } catch (err) {
      setError(err instanceof Error ? getUserMessage(err.message) : 'Não foi possível iniciar nova partida.')
    } finally {
      setRematchLoading(false)
    }
  }

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
      <div className="match-header">
        <Button variant="ghost" size="sm" className="match-back-btn" onClick={() => navigate('/games/tic-tac-toe')}>
          ← Lobby
        </Button>
        <h1 style={{ fontFamily: 'var(--font-display)', margin: 0 }}>Jogo da Velha</h1>
      </div>

      {error && (
        <Alert variant="error" style={{ marginBottom: 'var(--space-3)' }}>
          {error}
        </Alert>
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
        <div style={{ marginTop: 'var(--space-5)', display: 'flex', flexDirection: 'column', gap: 'var(--space-3)' }}>
          <Button onClick={handleNewMatch} disabled={rematchLoading}>
            {rematchLoading ? 'Criando...' : opponent ? `Nova partida (contra ${opponent.username})` : 'Nova partida'}
          </Button>
          {opponent && !friendIds.has(opponent.id) && (
            <>
              {addFriendStatus === 'idle' && (
                <Button variant="ghost" size="sm" onClick={handleAddFriend}>
                  Adicionar como amigo
                </Button>
              )}
              {addFriendStatus === 'loading' && (
                <span style={{ color: 'var(--text-muted)', fontSize: 'var(--size-sm)' }}>Enviando convite...</span>
              )}
              {addFriendStatus === 'sent' && (
                <span style={{ color: 'var(--text-muted)', fontSize: 'var(--size-sm)' }}>Convite enviado</span>
              )}
              {addFriendStatus === 'already_friends' && (
                <span style={{ color: 'var(--text-muted)', fontSize: 'var(--size-sm)' }}>Já são amigos</span>
              )}
            </>
          )}
          {opponent && (
            <Button variant="ghost" size="sm" onClick={() => navigate('/games/tic-tac-toe')}>
              Voltar ao lobby
            </Button>
          )}
        </div>
      )}
    </div>
  )
}
