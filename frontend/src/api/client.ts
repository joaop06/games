const base = '' // proxy in dev forwards /api to backend

async function request<T>(
  path: string,
  options: RequestInit & { json?: unknown } = {}
): Promise<T> {
  const { json, ...init } = options
  const headers: HeadersInit = { ...(init.headers as HeadersInit) }
  if (json !== undefined) {
    (headers as Record<string, string>)['Content-Type'] = 'application/json'
  }
  const res = await fetch(path.startsWith('http') ? path : `${base}${path}`, {
    ...init,
    headers,
    credentials: 'include',
    body: json !== undefined ? JSON.stringify(json) : init.body,
  })
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: res.statusText }))
    throw new Error((err as { error?: string }).error ?? 'Request failed')
  }
  if (res.status === 204 || res.headers.get('content-length') === '0') {
    return undefined as T
  }
  return res.json() as Promise<T>
}

export type UserResponse = {
  id: string
  email: string
  username: string
  createdAt: string
}

export const api = {
  async login(email: string, password: string): Promise<UserResponse> {
    const data = await request<{ user: UserResponse }>('/api/auth/login', {
      method: 'POST',
      json: { email, password },
    })
    return data!.user
  },
  async register(email: string, username: string, password: string): Promise<UserResponse> {
    const data = await request<{ user: UserResponse }>('/api/auth/register', {
      method: 'POST',
      json: { email, username, password },
    })
    return data!.user
  },
  async logout(): Promise<void> {
    await request('/api/auth/logout', { method: 'POST' })
  },
  async getMe(): Promise<UserResponse> {
    return request<UserResponse>('/api/users/me')
  },
  async patchMe(body: { username?: string }): Promise<UserResponse> {
    return request<UserResponse>('/api/users/me', { method: 'PATCH', json: body })
  },
  async getFriends(): Promise<{ friends: Array<{ id: string; username: string; createdAt: string }> }> {
    return request('/api/friends')
  },
  async getInvites(): Promise<{
    invites: Array<{ id: string; fromUser: { id: string; username: string }; createdAt: string }>
  }> {
    return request('/api/friends/invites')
  },
  async inviteFriend(username: string): Promise<unknown> {
    return request('/api/friends/invite', { method: 'POST', json: { username } })
  },
  async acceptInvite(id: string): Promise<unknown> {
    return request(`/api/friends/invites/${id}/accept`, { method: 'POST' })
  },
  async rejectInvite(id: string): Promise<unknown> {
    return request(`/api/friends/invites/${id}/reject`, { method: 'POST' })
  },

  async getWsToken(): Promise<{ token: string }> {
    return request<{ token: string }>('/api/auth/ws-token')
  },

  async createTicTacToeMatch(opponentUserId?: string): Promise<{ match: TicTacToeMatchState }> {
    return request('/api/games/tic-tac-toe/matches', {
      method: 'POST',
      json: opponentUserId != null ? { opponentUserId } : {},
    })
  },
  async listTicTacToeMatches(params?: { status?: string; limit?: number }): Promise<{
    matches: TicTacToeMatchListItem[]
  }> {
    const q = new URLSearchParams()
    if (params?.status) q.set('status', params.status)
    if (params?.limit != null) q.set('limit', String(params.limit))
    const query = q.toString()
    return request(`/api/games/tic-tac-toe/matches${query ? `?${query}` : ''}`)
  },
  async getTicTacToeMatch(matchId: string): Promise<{ match: TicTacToeMatchState }> {
    return request(`/api/games/tic-tac-toe/matches/${matchId}`)
  },
  async joinTicTacToeMatch(matchId: string): Promise<{ match: TicTacToeMatchState }> {
    return request(`/api/games/tic-tac-toe/matches/${matchId}/join`, { method: 'POST' })
  },
  async getTicTacToeStats(): Promise<{ stats: { wins: number; losses: number; draws: number } }> {
    return request('/api/games/tic-tac-toe/stats')
  },
  async getTicTacToeStatsVsFriend(
    friendId: string
  ): Promise<{ stats: { wins: number; losses: number; draws: number } }> {
    return request(`/api/games/tic-tac-toe/stats/vs-friend/${friendId}`)
  },
  async getTicTacToeLeaderboard(limit?: number): Promise<{
    leaderboard: Array<{ rank: number; userId: string; username: string; wins: number; losses: number; draws: number }>
  }> {
    const q = limit != null ? `?limit=${limit}` : ''
    return request(`/api/games/tic-tac-toe/leaderboard${q}`)
  },
}

export type TicTacToeBoard = (null | 'X' | 'O')[]
export type TicTacToeMatchState = {
  id: string
  gameType: string
  status: string
  winnerId: string | null
  playerX: { id: string; username: string } | undefined
  playerO: { id: string; username: string } | null
  board: TicTacToeBoard
  currentTurn: 'X' | 'O'
  moves: Array<{ position: number; playerId: string }>
}
export type TicTacToeMatchListItem = {
  id: string
  status: string
  winnerId: string | null
  playerX: { id: string; username: string }
  playerO: { id: string; username: string } | null
  createdAt: string
  finishedAt: string | null
}
