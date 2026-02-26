import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { api } from '../api/client'
import { useRealtime } from '../context/RealtimeContext'
import { useUsernameCheck } from '../hooks/useUsernameCheck'
import { normalizeUsername } from '../utils/username'
import { Alert, Button, Card, Input, PageSection } from './ui'
import GameStatsPills from './GameStatsPills'

type Friend = { id: string; username: string; createdAt: string }
type Invite = { id: string; fromUser: { id: string; username: string }; createdAt: string }

export default function FriendsSection() {
  const navigate = useNavigate()
  const { subscribe, showToast } = useRealtime()
  const [friends, setFriends] = useState<Friend[]>([])
  const [invites, setInvites] = useState<Invite[]>([])
  const [inviteUsername, setInviteUsername] = useState('')
  const [error, setError] = useState('')
  const [challengeError, setChallengeError] = useState('')
  const [loading, setLoading] = useState(false)
  const [loadingInvite, setLoadingInvite] = useState(false)
  const [challengingId, setChallengingId] = useState<string | null>(null)
  const [removingId, setRemovingId] = useState<string | null>(null)
  const [vsStats, setVsStats] = useState<Record<string, { wins: number; losses: number; draws: number }>>({})
  const { exists: inviteUsernameExists } = useUsernameCheck(inviteUsername)

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
    return subscribe((msg) => {
      if (msg.type === 'friend_invite') {
        api.getInvites().then((res) => setInvites(res.invites)).catch(() => {})
      }
      if (msg.type === 'friend_accepted') {
        api.getFriends().then((res) => setFriends(res.friends)).catch(() => {})
      }
      if (msg.type === 'friend_removed') {
        setFriends((prev) => prev.filter((f) => f.id !== msg.friendId))
      }
    })
  }, [subscribe])

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
    if (!inviteUsername) return
    setError('')
    setLoadingInvite(true)
    try {
      await api.inviteFriend(inviteUsername)
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

  async function handleRemoveFriend(friendId: string) {
    setRemovingId(friendId)
    setError('')
    try {
      await api.removeFriend(friendId)
      setFriends((prev) => prev.filter((f) => f.id !== friendId))
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao remover amigo')
    } finally {
      setRemovingId(null)
    }
  }

  async function challengeFriend(friendId: string) {
    if (!friendId || typeof friendId !== 'string' || !friendId.trim()) return
    setChallengingId(friendId)
    setChallengeError('')
    try {
      const res = await api.createTicTacToeMatch(friendId)
      if (res.opponentBusy) {
        const friend = friends.find((f) => f.id === friendId)
        showToast({
          type: 'game_invite_opponent_busy',
          username: friend?.username ?? 'Oponente',
        })
        return
      }
      if (res.match) {
        navigate(`/games/tic-tac-toe/match/${res.match.id}`)
      }
    } catch (err) {
      setChallengeError(err instanceof Error ? err.message : 'Erro ao desafiar')
    } finally {
      setChallengingId(null)
    }
  }

  return (
    <section style={{ marginTop: 'var(--space-6)' }}>
      <h2 style={{ fontFamily: 'var(--font-display)', fontSize: 'var(--size-lg)', marginBottom: 'var(--space-5)' }}>
        Amigos
      </h2>

      <PageSection title="Convidar por nome de usuário">
        <form onSubmit={handleSendInvite} className="form-invite-row">
          <div className="form-invite-field">
            <Input
              label="Nome de usuário"
              type="text"
              value={inviteUsername}
              onChange={(e) => setInviteUsername(normalizeUsername(e.target.value))}
              placeholder="Nome de usuário"
            />
          </div>
          <Button
            type="submit"
            variant="primary"
            size="md"
            loading={loadingInvite}
            className="form-invite-btn"
          >
            Enviar convite
          </Button>
        </form>
        {inviteUsername.length >= 2 && inviteUsernameExists === true && (
          <p style={{ color: 'var(--success)', fontSize: 'var(--size-sm)', marginTop: 'var(--space-2)' }}>
            Usuário encontrado. Pode enviar o convite.
          </p>
        )}
        {inviteUsername.length >= 2 && inviteUsernameExists === false && (
          <p style={{ color: 'var(--text-muted)', fontSize: 'var(--size-sm)', marginTop: 'var(--space-2)' }}>
            Nome de usuário não encontrado.
          </p>
        )}
        {error && (
          <Alert variant="error" style={{ marginTop: 'var(--space-2)' }}>
            {error}
          </Alert>
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
        {challengeError && (
          <Alert variant="error" style={{ marginBottom: 'var(--space-2)' }}>
            {challengeError}
          </Alert>
        )}
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
                  <div
                    style={{
                      display: 'flex',
                      flexDirection: 'column',
                      gap: 'var(--space-2)',
                      minWidth: 0,
                    }}
                  >
                    <span>{f.username}</span>
                    {vsStats[f.id] != null && (
                      <div
                        style={{
                          display: 'flex',
                          flexWrap: 'wrap',
                          alignItems: 'center',
                          gap: 'var(--space-2)',
                        }}
                      >
                        <span style={{ fontSize: 'var(--size-sm)', color: 'var(--text-muted)' }}>
                          Jogo da Velha:
                        </span>
                        <GameStatsPills
                          wins={vsStats[f.id].wins}
                          losses={vsStats[f.id].losses}
                          draws={vsStats[f.id].draws}
                          compact
                        />
                      </div>
                    )}
                  </div>
                  <div style={{ display: 'flex', gap: 'var(--space-2)' }}>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      loading={challengingId === f.id}
                      onClick={() => challengeFriend(f.id)}
                    >
                      Desafiar (Jogo da Velha)
                    </Button>
                    <Button
                      type="button"
                      variant="danger"
                      size="sm"
                      loading={removingId === f.id}
                      onClick={() => handleRemoveFriend(f.id)}
                    >
                      Remover
                    </Button>
                  </div>
                </Card>
              </li>
            ))}
          </ul>
        )}
      </PageSection>
    </section>
  )
}
