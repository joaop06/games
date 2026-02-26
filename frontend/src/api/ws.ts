import { api } from './client'

export type WsMessage =
  | {
      type: 'match_state'
      id: string
      gameType?: string
      status: string
      winnerId: string | null
      board: (null | 'X' | 'O')[]
      currentTurn: 'X' | 'O'
      playerX?: { id: string; username: string }
      playerO?: { id: string; username: string } | null
      moves?: Array<{ position: number; playerId: string }>
    }
  | { type: 'error'; code: string; message: string }

function getWsBaseUrl(): string {
  const proto = window.location.protocol === 'https:' ? 'wss:' : 'ws:'
  const host = window.location.host
  return `${proto}//${host}`
}

export type TicTacToeWsClient = {
  connect: (onMessage: (msg: WsMessage) => void) => Promise<void>
  disconnect: () => void
  send: (payload: object) => void
  isConnected: () => boolean
}

export function createTicTacToeWsClient(): TicTacToeWsClient {
  let ws: WebSocket | null = null
  let messageCb: ((msg: WsMessage) => void) | null = null

  return {
    isConnected: () => ws != null && ws.readyState === WebSocket.OPEN,

    async connect(onMessage: (msg: WsMessage) => void) {
      messageCb = onMessage
      const { token } = await api.getWsToken()
      const base = getWsBaseUrl()
      const url = `${base}/ws?token=${encodeURIComponent(token)}`
      ws = new WebSocket(url)
      return new Promise((resolve, reject) => {
        ws!.onopen = () => resolve()
        ws!.onerror = () => reject(new Error('WebSocket connection failed'))
        ws!.onmessage = (event) => {
          try {
            const msg = JSON.parse(event.data as string) as WsMessage
            messageCb?.(msg)
          } catch {
            messageCb?.({ type: 'error', code: 'parse_error', message: 'Invalid message' })
          }
        }
      })
    },

    disconnect() {
      if (ws) {
        ws.close()
        ws = null
      }
      messageCb = null
    },

    send(payload: object) {
      if (ws && ws.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify(payload))
      }
    },
  }
}
