import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useRealtime } from '../context/RealtimeContext';
import { api } from '../api/client';
import { Button } from './ui';

type NotificationItem = {
  id: string;
  type: string;
  read: boolean;
  createdAt: string;
  friendInvite: {
    id: string;
    status: string;
    fromUser: { id: string; username: string };
  } | null;
  gameInvite: {
    matchId: string;
    fromUser?: { id: string; username: string };
    gameType: string;
  } | null;
};

const BELL_STYLE: React.CSSProperties = {
  position: 'relative',
  padding: 'var(--space-2) var(--space-3)',
  minWidth: 44,
  minHeight: 44,
  boxSizing: 'border-box',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  background: 'transparent',
  border: 'none',
  borderRadius: 'var(--radius-md)',
  color: 'var(--text-muted)',
  cursor: 'pointer',
  lineHeight: 1,
  transition: 'color var(--transition-fast)',
};

function NotificationIcon({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      width={22}
      height={22}
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" />
      <path d="M13.73 21a2 2 0 0 1-3.46 0" />
    </svg>
  );
}
const PANEL_STYLE: React.CSSProperties = {
  position: 'absolute',
  top: '100%',
  right: 0,
  marginTop: 'var(--space-2)',
  minWidth: 280,
  maxWidth: 'min(400px, calc(100vw - var(--space-8)))',
  maxHeight: 400,
  overflowY: 'auto',
  background: 'var(--bg-elevated)',
  border: '1px solid var(--border)',
  borderRadius: 'var(--radius-lg)',
  boxShadow: 'var(--shadow-card)',
  zIndex: 1000,
  padding: 'var(--space-2)',
};
const ITEM_STYLE: React.CSSProperties = {
  padding: 'var(--space-3)',
  borderBottom: '1px solid var(--border)',
  fontSize: 'var(--size-sm)',
};
const BADGE_STYLE: React.CSSProperties = {
  position: 'absolute',
  top: 2,
  right: 2,
  minWidth: 18,
  height: 18,
  padding: '0 4px',
  borderRadius: 9,
  background: 'var(--danger)',
  color: '#fff',
  fontSize: 'var(--size-xs)',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
};

export default function NotificationPanel() {
  const navigate = useNavigate();
  const { unreadCount, setUnreadCount } = useRealtime();
  const [open, setOpen] = useState(false);
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [loading, setLoading] = useState(false);
  const panelRef = useRef<HTMLDivElement>(null);

  const fetchNotifications = async () => {
    setLoading(true);
    try {
      const res = await api.getNotifications();
      const seen = new Set<string>();
      const deduped = res.notifications.filter((n: NotificationItem) => {
        const key = n.gameInvite?.matchId ?? n.friendInvite?.id ?? n.id;
        if (seen.has(key)) return false;
        seen.add(key);
        return true;
      });
      setNotifications(deduped);
    } catch {
      setNotifications([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (open) {
      setUnreadCount(0);
      fetchNotifications();
    }
  }, [open, setUnreadCount]);

  useEffect(() => {
    api
      .getNotifications()
      .then((res) => {
        const seen = new Set<string>();
        const deduped = res.notifications.filter((n: NotificationItem) => {
          const key = n.gameInvite?.matchId ?? n.friendInvite?.id ?? n.id;
          if (seen.has(key)) return false;
          seen.add(key);
          return true;
        });
        const count = deduped.filter((n: NotificationItem) => !n.read).length;
        setUnreadCount(count);
      })
      .catch(() => {});
  }, [setUnreadCount]);

  useEffect(() => {
    if (!open) return;
    function handleClickOutside(e: MouseEvent) {
      if (panelRef.current && !panelRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [open]);

  const handleAccept = async (inviteId: string, notificationId: string) => {
    try {
      await api.acceptInvite(inviteId);
      setNotifications((prev) => prev.filter((n) => n.id !== notificationId));
    } catch {}
  };

  const handleReject = async (inviteId: string, notificationId: string) => {
    try {
      await api.rejectInvite(inviteId);
      setNotifications((prev) => prev.filter((n) => n.id !== notificationId));
    } catch {}
  };

  const handleAcceptGameInvite = async (matchId: string, notificationId: string) => {
    try {
      await api.joinTicTacToeMatch(matchId);
      setNotifications((prev) => prev.filter((n) => n.id !== notificationId));
      setOpen(false);
      navigate(`/games/tic-tac-toe/match/${matchId}`);
    } catch {}
  };

  const handleMarkAllRead = async () => {
    try {
      await api.markAllNotificationsRead();
      setUnreadCount(0);
      setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
    } catch {}
  };

  const unreadNotifications = notifications.filter((n) => !n.read);
  const hasUnread = unreadNotifications.length > 0;

  return (
    <div ref={panelRef} style={{ position: 'relative' }}>
      <button
        type="button"
        aria-label="Notificações"
        style={BELL_STYLE}
        onClick={() => setOpen((o) => !o)}
        onMouseOver={(e) => {
          e.currentTarget.style.color = 'var(--accent)';
        }}
        onMouseOut={(e) => {
          e.currentTarget.style.color = 'var(--text-muted)';
        }}
      >
        <NotificationIcon />
        {unreadCount > 0 && (
          <span style={BADGE_STYLE}>{unreadCount > 99 ? '99+' : unreadCount}</span>
        )}
      </button>
      {open && (
        <div style={PANEL_STYLE}>
          <div
            style={{
              padding: 'var(--space-2)',
              fontWeight: 700,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: 'var(--space-2)',
            }}
          >
            <span>Notificações</span>
            {hasUnread && (
              <Button variant="ghost" size="sm" onClick={handleMarkAllRead}>
                Ler
              </Button>
            )}
          </div>
          {loading ? (
            <div style={{ ...ITEM_STYLE, color: 'var(--text-muted)' }}>Carregando...</div>
          ) : unreadNotifications.length === 0 ? (
            <div style={{ ...ITEM_STYLE, color: 'var(--text-muted)' }}>Nenhuma notificação</div>
          ) : (
            <ul style={{ listStyle: 'none', margin: 0, padding: 0 }}>
              {unreadNotifications.map((n) => {
                const inv = n.friendInvite;
                const gameInv = n.gameInvite;
                return (
                  <li key={n.id} style={ITEM_STYLE}>
                    {n.type === 'friend_invite' && inv && (
                      <>
                        <span style={{ color: 'var(--text-primary)' }}>
                          {inv.fromUser.username}
                          {inv.status === 'pending' ? ' enviou convite de amizade' : ' — Amigos'}
                        </span>
                        {inv.status === 'pending' && (
                          <div
                            style={{
                              marginTop: 'var(--space-2)',
                              display: 'flex',
                              gap: 'var(--space-2)',
                            }}
                          >
                            <Button
                              variant="primary"
                              size="sm"
                              onClick={() => handleAccept(inv.id, n.id)}
                            >
                              Aceitar
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleReject(inv.id, n.id)}
                            >
                              Cancelar
                            </Button>
                          </div>
                        )}
                      </>
                    )}
                    {n.type === 'game_invite' && gameInv && (
                      <>
                        <span style={{ color: 'var(--text-primary)' }}>
                          {gameInv.fromUser?.username ?? 'Alguém'} te desafiou para Jogo da Velha
                        </span>
                        <div
                          style={{
                            marginTop: 'var(--space-2)',
                            display: 'flex',
                            gap: 'var(--space-2)',
                          }}
                        >
                          <Button
                            variant="primary"
                            size="sm"
                            onClick={() => handleAcceptGameInvite(gameInv.matchId, n.id)}
                          >
                            Aceitar
                          </Button>
                        </div>
                      </>
                    )}
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}
