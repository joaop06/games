import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { Button, Card, Input } from '../components/ui'

export default function Login() {
  const [identifier, setIdentifier] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const { login, user, loading } = useAuth()
  const navigate = useNavigate()

  if (loading) {
    return (
      <div
        className="auth-page"
        style={{
          minHeight: '100vh',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <p style={{ color: 'var(--text-muted)' }}>Verificando sessão...</p>
      </div>
    )
  }

  if (user) {
    navigate('/', { replace: true })
    return null
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    setSubmitting(true)
    try {
      await login(identifier, password)
      navigate('/', { replace: true })
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao entrar')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div
      className="auth-page"
      style={{
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      <Card
        glow
        style={{
          width: '100%',
          maxWidth: 360,
        }}
      >
        <h1
          style={{
            fontFamily: 'var(--font-display)',
            marginBottom: 'var(--space-5)',
            fontSize: 'var(--size-2xl)',
          }}
        >
          Entrar
        </h1>
        <form onSubmit={handleSubmit}>
          {error && (
            <p
              role="alert"
              style={{
                color: 'var(--danger)',
                marginBottom: 'var(--space-4)',
                fontSize: 'var(--size-sm)',
              }}
            >
              {error}
            </p>
          )}
          <Input
            label="Nome de usuário"
            type="text"
            value={identifier}
            onChange={(e) => setIdentifier(e.target.value)}
            required
            autoComplete="username"
          />
          <Input
            label="Senha"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            autoComplete="current-password"
          />
          <Button
            type="submit"
            variant="primary"
            size="md"
            loading={submitting}
            className="auth-submit"
            style={{ width: '100%' }}
          >
            {loading ? 'Entrando...' : 'Entrar'}
          </Button>
        </form>
        <p style={{ marginTop: 'var(--space-4)', color: 'var(--text-muted)' }}>
          Não tem conta? <Link to="/register">Cadastre-se</Link>
        </p>
      </Card>
    </div>
  )
}
