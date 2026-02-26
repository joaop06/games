import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { api, type TicTacToeMatchListItem } from '../api/client'
import Button from '../components/ui/Button'
import Card from '../components/ui/Card'

export default function TicTacToeLobby() {
  const navigate = useNavigate()
  const { user } = useAuth()
  const [matches, setMatches] = useState<TicTacToeMatchListItem[]>([])
  const [loading, setLoading] = useState(true)
  const [creating, setCreating] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    api
      .listTicTacToeMatches({ limit: 20 })
      .then((res) => setMatches(res.matches))
      .catch(() => setError('Falha ao carregar partidas'))
      .finally(() => setLoading(false))
  }, [])

  const handleCreateQuick = async () => {
    setCreating(true)
    setError(null)
    try {
      const { match } = await api.createTicTacToeMatch()
      navigate(`/games/tic-tac-toe/match/${match.id}`)
    } catch (e) {
      setError((e as Error).message ?? 'Falha ao criar partida')
    } finally {
      setCreating(false)
    }
  }

  const handleJoin = async (matchId: string) => {
    setError(null)
    try {
      await api.joinTicTacToeMatch(matchId)
      navigate(`/games/tic-tac-toe/match/${matchId}`)
    } catch (e) {
      setError((e as Error).message ?? 'Falha ao entrar na partida')
    }
  }

  const waitingMatches = matches.filter((m) => m.status === 'waiting' && m.playerX.id !== user?.id)
  const myActiveMatches = matches.filter(
    (m) => (m.playerX.id === user?.id || m.playerO?.id === user?.id) && (m.status === 'waiting' || m.status === 'in_progress')
  )

  return (
    <div>
      <h1 style={{ fontFamily: 'var(--font-display)', marginBottom: 'var(--space-4)' }}>Jogo da Velha</h1>
      <p style={{ color: 'var(--text-muted)', marginBottom: 'var(--space-6)' }}>
        Crie uma partida rápida (qualquer um pode entrar) ou desafie um amigo pela página de Amigos.
      </p>

      {error && (
        <p style={{ color: 'var(--danger)', marginBottom: 'var(--space-3)' }} role="alert">
          {error}
        </p>
      )}

      <section style={{ marginBottom: 'var(--space-6)' }}>
        <h2 style={{ fontFamily: 'var(--font-display)', fontSize: 'var(--size-lg)', marginBottom: 'var(--space-3)' }}>
          Nova partida
        </h2>
        <Button onClick={handleCreateQuick} disabled={creating}>
          {creating ? 'Criando...' : 'Partida rápida'}
        </Button>
      </section>

      <section style={{ marginBottom: 'var(--space-6)' }}>
        <h2 style={{ fontFamily: 'var(--font-display)', fontSize: 'var(--size-lg)', marginBottom: 'var(--space-3)' }}>
          Suas partidas
        </h2>
        {loading ? (
          <p style={{ color: 'var(--text-muted)' }}>Carregando...</p>
        ) : myActiveMatches.length === 0 ? (
          <p style={{ color: 'var(--text-muted)' }}>Nenhuma partida ativa. Crie uma acima.</p>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-3)' }}>
            {myActiveMatches.map((m) => (
              <Card key={m.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <span>
                  {m.playerX.username} vs {m.playerO?.username ?? '...'}
                </span>
                <span style={{ color: 'var(--text-muted)', fontSize: 'var(--size-sm)' }}>{m.status}</span>
                <Button size="sm" onClick={() => navigate(`/games/tic-tac-toe/match/${m.id}`)}>
                  Entrar
                </Button>
              </Card>
            ))}
          </div>
        )}
      </section>

      <section>
        <h2 style={{ fontFamily: 'var(--font-display)', fontSize: 'var(--size-lg)', marginBottom: 'var(--space-3)' }}>
          Partidas à espera de jogador
        </h2>
        {loading ? (
          <p style={{ color: 'var(--text-muted)' }}>Carregando...</p>
        ) : waitingMatches.length === 0 ? (
          <p style={{ color: 'var(--text-muted)' }}>Nenhuma partida disponível. Crie uma partida rápida.</p>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-3)' }}>
            {waitingMatches.map((m) => (
              <Card key={m.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <span>{m.playerX.username} está esperando</span>
                <Button size="sm" onClick={() => handleJoin(m.id)}>
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
