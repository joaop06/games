import { useState, useEffect, useCallback } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useRealtime } from '../context/RealtimeContext'
import { api } from '../api/client'
import { Button, Card } from '../components/ui'
import TicTacToeIcon from '../components/tic-tac-toe/TicTacToeIcon'

const ONLINE_POLL_INTERVAL_MS = 20_000

export default function TicTacToeLobby() {
  const navigate = useNavigate()
  const { connection, subscribe } = useRealtime()
  const [searching, setSearching] = useState(false)
  const [onlineCount, setOnlineCount] = useState<number | null>(null)
  const [searchingDots, setSearchingDots] = useState('.')

  useEffect(() => {
    connection.send({ type: 'join_lobby', gameType: 'tic_tac_toe' })
    return () => {
      connection.send({ type: 'leave_lobby', gameType: 'tic_tac_toe' })
    }
  }, [connection])

  useEffect(() => {
    const fetchCount = () => {
      api.getTicTacToeOnlineCount().then(({ count }) => setOnlineCount(count)).catch(() => {})
    }
    fetchCount()
    const interval = setInterval(fetchCount, ONLINE_POLL_INTERVAL_MS)
    return () => clearInterval(interval)
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

  useEffect(() => {
    if (!searching) return
    const id = setInterval(() => {
      setSearchingDots((d) => (d.length >= 3 ? '.' : d + '.'))
    }, 400)
    return () => clearInterval(id)
  }, [searching])

  const handleSearchMatch = useCallback(() => {
    setSearching(true)
    connection.send({ type: 'join_queue', gameType: 'tic_tac_toe' })
  }, [connection])

  const handleLeaveQueue = useCallback(() => {
    connection.send({ type: 'leave_queue', gameType: 'tic_tac_toe' })
    setSearching(false)
  }, [connection])

  return (
    <div className="tic-tac-toe-lobby">
      <header className="tic-tac-toe-lobby__hero">
        <TicTacToeIcon className="tic-tac-toe-lobby__hero-icon" />
        <h1>Jogo da Velha</h1>
      </header>

      <p className="tic-tac-toe-lobby__desc">
        Entre na fila para jogar contra outro jogador ou desafie um amigo pela página de Amigos.
      </p>

      {onlineCount !== null && (
        <div className="tic-tac-toe-lobby__badge" role="status" aria-live="polite">
          <span className="tic-tac-toe-lobby__badge-dot" aria-hidden />
          <span>
            {onlineCount} jogador{onlineCount !== 1 ? 'es' : ''} online
          </span>
        </div>
      )}

      <div className="tic-tac-toe-lobby__cards">
        <Card glow style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' }}>
          <h2 style={{ fontFamily: 'var(--font-display)', fontSize: 'var(--size-lg)', margin: 0 }}>
            Nova partida
          </h2>
          <p style={{ color: 'var(--text-muted)', fontSize: 'var(--size-sm)', margin: 0 }}>
            Encontre um oponente aleatório na fila.
          </p>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 'var(--space-3)' }}>
            <Button
              className="lobby-btn"
              onClick={handleSearchMatch}
              disabled={searching}
            >
              {searching ? `Procurando oponente${searchingDots}` : 'Procurar partida'}
            </Button>
            {searching && (
              <Button variant="ghost" className="lobby-btn" onClick={handleLeaveQueue}>
                Cancelar
              </Button>
            )}
          </div>
        </Card>

        <Link to="/friends" className="tic-tac-toe-lobby__friend-card">
          <Card
            style={{
              height: '100%',
              display: 'flex',
              flexDirection: 'column',
              gap: 'var(--space-3)',
              transition: 'box-shadow var(--transition-fast), border-color var(--transition-fast)',
            }}
          >
            <h2 style={{ fontFamily: 'var(--font-display)', fontSize: 'var(--size-lg)', margin: 0 }}>
              Desafie um amigo
            </h2>
            <p style={{ color: 'var(--text-muted)', fontSize: 'var(--size-sm)', margin: 0, flex: 1 }}>
              Convide um amigo e jogue uma partida.
            </p>
            <span style={{ color: 'var(--accent)', fontSize: 'var(--size-sm)', fontWeight: 'var(--weight-bold)' }}>
              Ir para Amigos →
            </span>
          </Card>
        </Link>
      </div>
    </div>
  )
}
