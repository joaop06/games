import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { api } from '../api/client'
import { Button, Card, Input, PageSection } from '../components/ui'

type Friend = { id: string; username: string; createdAt: string }
type Invite = { id: string; fromUser: { id: string; username: string }; createdAt: string }

export default function Friends() {
  const navigate = useNavigate()
  const [friends, setFriends] = useState<Friend[]>([])
  const [invites, setInvites] = useState<Invite[]>([])
  const [inviteUsername, setInviteUsername] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [loadingInvite, setLoadingInvite] = useState(false)
  const [challengingId, setChallengingId] = useState<string | null>(null)
  const [vsStats, setVsStats] = useState<Record<string, { wins: number; losses: number; draws: number }>>({})

  useEffect(() => {
    let cancelled = false
    async function load() {
      try {
        const [friendsRes, invitesRes] = await Promise.all([
          api.getFriends(),
          api.getInvites(),
        ])
        if (!cancelled) {
          setFriends(friendsRes.friends)
          setInvites(invitesRes.invites)
        }
      } catch {
        if (!cancelled) setFriends([])
      }
    }
    load()
    return () => { cancelled = true }
  }, [])

  useEffect(() => {
    if (friends.length === 0) return
    const abort = new AbortController()
    friends.forEach((f) => {
      api.getTicTacToeStatsVsFriend(f.id).then(
        (res) => setVsStats((prev) => ({ ...prev, [f.id]: res.stats })),
        () => {}
      )
    })
    return () => abort.abort()
  }, [friends])

  async function handleSendInvite(e: React.FormEvent) {
    e.preventDefault()
    const username = inviteUsername.trim()
    if (!username) return
    setError('')
    setLoadingInvite(true)
    try {
      await api.inviteFriend(username)
      setInviteUsername('')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao enviar convite')
    } finally {
      setLoadingInvite(false)
    }
  }

  async function accept(id: string) {
    setLoading(true)
    try {
      await api.acceptInvite(id)
      setInvites((prev) => prev.filter((i) => i.id !== id))
      const res = await api.getFriends()
      setFriends(res.friends)
    } finally {
      setLoading(false)
    }
  }

  async function reject(id: string) {
    setLoading(true)
    try {
      await api.rejectInvite(id)
      setInvites((prev) => prev.filter((i) => i.id !== id))
    } finally {
      setLoading(false)
    }
  }

  async function challengeFriend(friendId: string) {
    setChallengingId(friendId)
    setError('')
    try {
      const { match } = await api.createTicTacToeMatch(friendId)
      navigate(`/games/tic-tac-toe/match/${match.id}`)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao desafiar')
    } finally {
      setChallengingId(null)
    }
  }

  return (
    <div>
      <h1 style={{ fontFamily: 'var(--font-display)', marginBottom: 'var(--space-5)' }}>
        Amigos
      </h1>

      <PageSection title="Convidar por nome de usuário">
        <form
          onSubmit={handleSendInvite}
          style={{
            display: 'flex',
            gap: 'var(--space-2)',
            alignItems: 'flex-end',
            flexWrap: 'wrap',
          }}
        >
          <div style={{ flex: 1, minWidth: 180 }}>
            <Input
              label="Nome de usuário"
              type="text"
              value={inviteUsername}
              onChange={(e) => setInviteUsername(e.target.value)}
              placeholder="Nome de usuário"
            />
          </div>
          <Button
            type="submit"
            variant="primary"
            size="md"
            loading={loadingInvite}
          >
            Enviar convite
          </Button>
        </form>
        {error && (
          <p role="alert" style={{ color: 'var(--danger)', marginTop: 'var(--space-2)', fontSize: 'var(--size-sm)' }}>
            {error}
          </p>
        )}
      </PageSection>

      <PageSection title="Convites recebidos">
        {invites.length === 0 ? (
          <p style={{ color: 'var(--text-muted)' }}>Nenhum convite pendente.</p>
        ) : (
          <ul style={{ listStyle: 'none', padding: 0, margin: 0 }}>
            {invites.map((i) => (
              <li key={i.id} style={{ marginBottom: 'var(--space-2)' }}>
                <Card
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    flexWrap: 'wrap',
                    gap: 'var(--space-2)',
                    padding: 'var(--space-3)',
                  }}
                >
                  <span>{i.fromUser.username}</span>
                  <div style={{ display: 'flex', gap: 'var(--space-2)' }}>
                    <Button
                      type="button"
                      variant="success"
                      size="sm"
                      loading={loading}
                      onClick={() => accept(i.id)}
                    >
                      Aceitar
                    </Button>
                    <Button
                      type="button"
                      variant="danger"
                      size="sm"
                      loading={loading}
                      onClick={() => reject(i.id)}
                    >
                      Rejeitar
                    </Button>
                  </div>
                </Card>
              </li>
            ))}
          </ul>
        )}
      </PageSection>

      <PageSection title="Lista de amigos">
        {friends.length === 0 ? (
          <p style={{ color: 'var(--text-muted)' }}>
            Você ainda não tem amigos. Envie convites acima.
          </p>
        ) : (
          <ul style={{ listStyle: 'none', padding: 0, margin: 0 }}>
            {friends.map((f) => (
              <li key={f.id} style={{ marginBottom: 'var(--space-2)' }}>
                <Card
                  style={{
                    padding: 'var(--space-3)',
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    flexWrap: 'wrap',
                    gap: 'var(--space-2)',
                  }}
                >
                  <div>
                    <span>{f.username}</span>
                    {vsStats[f.id] != null && (
                      <span style={{ marginLeft: 'var(--space-3)', color: 'var(--text-muted)', fontSize: 'var(--size-sm)' }}>
                        Você {vsStats[f.id].wins} × {vsStats[f.id].losses} {f.username}
                        {vsStats[f.id].draws > 0 && ` · ${vsStats[f.id].draws} empate(s)`}
                      </span>
                    )}
                  </div>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    loading={challengingId === f.id}
                    onClick={() => challengeFriend(f.id)}
                  >
                    Desafiar (Jogo da Velha)
                  </Button>
                </Card>
              </li>
            ))}
          </ul>
        )}
      </PageSection>
    </div>
  )
}
