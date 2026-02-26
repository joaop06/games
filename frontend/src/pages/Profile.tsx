import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { api } from '../api/client'
import { Card } from '../components/ui'
import FriendsSection from '../components/FriendsSection'
import GameStatsPills from '../components/GameStatsPills'

export default function Profile() {
  const { user } = useAuth()
  const [tttStats, setTttStats] = useState<{ wins: number; losses: number; draws: number } | null>(null)

  useEffect(() => {
    api
      .getTicTacToeStats()
      .then((res) => setTttStats(res.stats))
      .catch(() => setTttStats(null))
  }, [])

  return (
    <div>
      <h1 style={{ fontFamily: 'var(--font-display)', marginBottom: 'var(--space-4)' }}>
        Perfil
      </h1>
      {user && (
        <>
          <Card glow style={{ marginBottom: 'var(--space-5)' }}>
            <p><strong>Usuário:</strong> {user.username}</p>
          </Card>

          <Card style={{ marginBottom: 'var(--space-4)' }}>
            <h2 style={{ fontFamily: 'var(--font-display)', fontSize: 'var(--size-lg)', marginBottom: 'var(--space-3)' }}>
              Jogo da Velha
            </h2>
            {tttStats != null ? (
              <div style={{ marginBottom: 'var(--space-3)' }}>
                <GameStatsPills wins={tttStats.wins} losses={tttStats.losses} draws={tttStats.draws} />
              </div>
            ) : (
              <p style={{ color: 'var(--text-muted)' }}>Carregando estatísticas...</p>
            )}
            <Link to="/games/tic-tac-toe" style={{ color: 'var(--accent)', fontSize: 'var(--size-sm)' }}>
              Ir para o Jogo da Velha →
            </Link>
          </Card>

          <FriendsSection />
        </>
      )}
    </div>
  )
}
