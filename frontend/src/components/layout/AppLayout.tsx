import { Outlet, NavLink, useNavigate } from 'react-router-dom'
import { useAuth } from '../../context/AuthContext'

const navLinkStyle = ({ isActive }: { isActive: boolean }) => ({
  color: isActive ? 'var(--accent-hover)' : 'var(--accent)',
  fontWeight: isActive ? 700 : 400,
  textDecoration: isActive ? 'underline' : 'none',
  padding: 'var(--space-2) var(--space-3)',
  borderRadius: 'var(--radius-md)',
  transition: 'color var(--transition-fast), background var(--transition-fast)',
})

export default function AppLayout() {
  const { user, logout } = useAuth()
  const navigate = useNavigate()

  async function handleLogout() {
    await logout()
    navigate('/login', { replace: true })
  }

  return (
    <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>
      <header
        style={{
          background: 'var(--bg-card)',
          borderBottom: '1px solid var(--border)',
          padding: 'var(--space-3) var(--space-5)',
          boxShadow: 'var(--shadow-card)',
        }}
      >
        <nav
          style={{
            maxWidth: 960,
            margin: '0 auto',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: 'var(--space-5)',
            flexWrap: 'wrap',
          }}
        >
          <NavLink
            to="/"
            style={({ isActive }) => ({
              ...navLinkStyle({ isActive }),
              fontFamily: 'var(--font-display)',
              fontSize: 'var(--size-lg)',
            })}
          >
            Arcade
          </NavLink>
          <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-4)' }}>
            <NavLink to="/" style={navLinkStyle}>
              Início
            </NavLink>
            <NavLink to="/profile" style={navLinkStyle}>
              Perfil
            </NavLink>
            <NavLink to="/friends" style={navLinkStyle}>
              Amigos
            </NavLink>
            <NavLink to="/games/tic-tac-toe" style={navLinkStyle}>
              Jogo da Velha
            </NavLink>
            {user && (
              <>
                <span style={{ color: 'var(--text-muted)', fontSize: 'var(--size-sm)' }}>
                  {user.username}
                </span>
                <button
                  type="button"
                  onClick={handleLogout}
                  style={{
                    padding: 'var(--space-2) var(--space-3)',
                    borderRadius: 'var(--radius-md)',
                    background: 'transparent',
                    color: 'var(--text-muted)',
                    border: '1px solid var(--border)',
                    cursor: 'pointer',
                    fontSize: 'var(--size-sm)',
                    transition: 'color var(--transition-fast), border-color var(--transition-fast)',
                  }}
                  onMouseOver={(e) => {
                    e.currentTarget.style.color = 'var(--text-primary)'
                    e.currentTarget.style.borderColor = 'var(--accent)'
                  }}
                  onMouseOut={(e) => {
                    e.currentTarget.style.color = 'var(--text-muted)'
                    e.currentTarget.style.borderColor = 'var(--border)'
                  }}
                >
                  Sair
                </button>
              </>
            )}
          </div>
        </nav>
      </header>
      <main
        style={{
          flex: 1,
          maxWidth: 960,
          margin: '0 auto',
          width: '100%',
          padding: 'var(--space-6) var(--space-5)',
        }}
      >
        <Outlet />
      </main>
    </div>
  )
}
