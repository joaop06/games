import { useState, useEffect, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { useRealtime } from '../context/RealtimeContext'
import { api, type TicTacToeMatchListItem } from '../api/client'
import { Alert, Button, Card } from '../components/ui'

export default function TicTacToeLobby() {
  const navigate = useNavigate()
  const { user } = useAuth()
  const { connection, subscribe } = useRealtime()
  const [matches, setMatches] = useState<TicTacToeMatchListItem[]>([])
  const [loading, setLoading] = useState(true)
  const [searching, setSearching] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    api
      .listTicTacToeMatches({ limit: 20 })
      .then((res) => setMatches(res.matches))
      .catch(() => setError('Falha ao carregar partidas'))
      .finally(() => setLoading(false))
  }, [])

  useEffect(() => {
    const unsub = subscribe((msg) => {
      if (msg.type === 'match_ready' && msg.matchId) {
        setSearching(false)
        navigate(`/games/tic-tac-toe/match/${msg.matchId}`)
      }
    })
    return unsub
  }, [subscribe, navigate])

  const handleSearchMatch = useCallback(() => {
    setError(null)
    setSearching(true)
    connection.send({ type: 'join_queue', gameType: 'tic_tac_toe' })
  }, [connection])

  const handleLeaveQueue = useCallback(() => {
    connection.send({ type: 'leave_queue', gameType: 'tic_tac_toe' })
    setSearching(false)
  }, [connection])

  const activeRaw = matches.filter(
    (m) => (m.playerX.id === user?.id || m.playerO?.id === user?.id) && (m.status === 'waiting' || m.status === 'in_progress')
  )
  const inProgressMatches = activeRaw.filter((m) => m.status === 'in_progress')
  const waitingAsO = activeRaw.filter((m) => m.status === 'waiting' && m.playerO?.id === user?.id)
  const waitingAsX = activeRaw
    .filter((m) => m.status === 'waiting' && m.playerX.id === user?.id)
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
    .slice(0, 1)
  const myActiveMatches = [...inProgressMatches, ...waitingAsO, ...waitingAsX]

  return (
    <div>
      <h1 style={{ fontFamily: 'var(--font-display)', marginBottom: 'var(--space-4)' }}>Jogo da Velha</h1>
      <p style={{ color: 'var(--text-muted)', marginBottom: 'var(--space-6)' }}>
        Entre na fila para jogar contra outro jogador ou desafie um amigo pela página de Amigos.
      </p>

      {error && (
        <Alert variant="error" style={{ marginBottom: 'var(--space-3)' }}>
          {error}
        </Alert>
      )}

      <section style={{ marginBottom: 'var(--space-6)' }}>
        <h2 style={{ fontFamily: 'var(--font-display)', fontSize: 'var(--size-lg)', marginBottom: 'var(--space-3)' }}>
          Nova partida
        </h2>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 'var(--space-3)' }}>
          <Button
            className="lobby-btn"
            onClick={handleSearchMatch}
            disabled={searching}
          >
            {searching ? 'Procurando oponente...' : 'Procurar partida'}
          </Button>
          {searching && (
            <Button variant="ghost" className="lobby-btn" onClick={handleLeaveQueue}>
              Cancelar
            </Button>
          )}
        </div>
      </section>

      <section style={{ marginBottom: 'var(--space-6)' }}>
        <h2 style={{ fontFamily: 'var(--font-display)', fontSize: 'var(--size-lg)', marginBottom: 'var(--space-3)' }}>
          Suas partidas
        </h2>
        {loading ? (
          <p style={{ color: 'var(--text-muted)' }}>Carregando...</p>
        ) : myActiveMatches.length === 0 ? (
          <p style={{ color: 'var(--text-muted)' }}>Nenhuma partida ativa. Procure uma partida acima.</p>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-3)' }}>
            {myActiveMatches.map((m) => (
              <Card key={m.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <span>
                  {m.playerX.username} vs {m.playerO?.username ?? '...'}
                </span>
                <span style={{ color: 'var(--text-muted)', fontSize: 'var(--size-sm)' }}>{m.status}</span>
                <Button size="sm" className="lobby-btn" onClick={() => navigate(`/games/tic-tac-toe/match/${m.id}`)}>
                  Entrar
                </Button>
              </Card>
            ))}
          </div>
        )}
      </section>
    </div>
  )
}
