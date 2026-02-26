import { useEffect, useRef } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { useRealtime } from '../context/RealtimeContext'
import { api } from '../api/client'

function isInMatchPath(pathname: string): boolean {
  return /^\/games\/tic-tac-toe\/match\//.test(pathname)
}

function getMatchIdFromPath(pathname: string): string | null {
  const m = pathname.match(/\/games\/tic-tac-toe\/match\/([^/]+)/)
  return m ? m[1] : null
}

export default function RealtimeToastsHandler() {
  const { subscribe, showToast, addUnreadNotification } = useRealtime()
  const location = useLocation()
  const navigate = useNavigate()
  const pathnameRef = useRef(location.pathname)
  pathnameRef.current = location.pathname

  useEffect(() => {
    return subscribe((msg) => {
      const pathname = pathnameRef.current
      const onProfilePage = pathname === '/profile'
      const inMatch = isInMatchPath(pathname)

      if (msg.type === 'friend_invite') {
        const username = msg.fromUser?.username ?? 'Alguém'
        if (onProfilePage) return
        if (inMatch) {
          addUnreadNotification()
          return
        }
        addUnreadNotification()
        showToast({
          type: 'friend_invite',
          username,
        })
      }

      if (msg.type === 'game_invite') {
        const currentMatchId = getMatchIdFromPath(pathname)
        if (inMatch && currentMatchId === msg.matchId) {
          addUnreadNotification()
          return
        }
        addUnreadNotification()
        const username = msg.fromUser?.username ?? 'Alguém'
        const matchId = msg.matchId
        showToast({
          type: 'game_invite',
          username,
          matchId,
          onAccept: () => {
            if (!matchId) return
            api.joinTicTacToeMatch(matchId).then(() => {
              navigate(`/games/tic-tac-toe/match/${matchId}`)
            }).catch(() => {})
          },
          onCancel: () => {},
        })
      }

      if (msg.type === 'game_invite_opponent_busy') {
        showToast({
          type: 'game_invite_opponent_busy',
          username: msg.opponentUsername ?? 'Oponente',
        })
      }
    })
  }, [subscribe, showToast, addUnreadNotification, navigate])

  return null
}
