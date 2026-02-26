/**
 * Mapeia mensagens de erro da API (e status HTTP) para texto amigável em português.
 * Usado pelo cliente API e por componentes que exibem erros (ex.: WebSocket).
 */

const MESSAGES: Record<string, string> = {
  // Rate limit (429) e variações
  'Too Many Requests': 'Muitas tentativas. Aguarde um momento e tente novamente.',

  // Auth
  'Username already in use': 'Este nome de usuário já está em uso.',
  'Validation failed': 'Dados inválidos. Verifique os campos.',
  'Usuário ou senha inválidos': 'Usuário ou senha inválidos.',
  'Username must be lowercase letters and numbers only': 'Nome de usuário deve ter apenas letras minúsculas e números.',
  'Username must be 2–32 chars, lowercase letters and numbers only': 'Nome de usuário deve ter 2 a 32 caracteres, apenas letras minúsculas e números.',
  'Invalid uuid': 'ID inválido. Verifique o ID do oponente.',
  'opponentUserId required. Use the matchmaking queue to find a match, or provide opponentUserId to challenge a friend.': 'Informe o oponente para desafiar ou use a fila para encontrar partida.',
  Unauthorized: 'Sessão inválida ou expirada. Faça login novamente.',
  'Missing refresh token': 'Sessão expirada. Faça login novamente.',
  'Invalid or expired refresh token': 'Sessão expirada. Faça login novamente.',
  'User not found': 'Usuário não encontrado.',

  // Users
  'Invalid username': 'Nome de usuário inválido.',

  // Friends
  'Provide username or userId': 'Informe o nome de usuário.',
  'Cannot invite yourself': 'Você não pode se convidar.',
  'Already friends': 'Vocês já são amigos.',
  'Invite already sent': 'Convite já enviado para este usuário.',
  'Invite not found': 'Convite não encontrado.',
  'Invite already processed': 'Este convite já foi respondido.',
  'Cannot remove yourself': 'Você não pode se remover da lista.',
  'Friendship not found': 'Amizade não encontrada.',

  // Games (tic-tac-toe)
  'Cannot play against yourself': 'Você não pode jogar contra si mesmo.',
  'Can only challenge friends': 'Só é possível desafiar amigos.',
  'Match not found': 'Partida não encontrada.',
  'Not a player in this match': 'Você não faz parte desta partida.',
  'Match is not waiting for a player': 'A partida não está aguardando jogador.',
  'You are already in this match': 'Você já está nesta partida.',
  'User is not your friend': 'Este usuário não é seu amigo.',

  // Notifications
  'Notification not found': 'Notificação não encontrada.',

  // WebSocket / genérico
  'Invalid message': 'Mensagem inválida. Tente novamente.',
  'Request failed': 'Falha na requisição. Tente novamente.',
}

const FALLBACK = 'Algo deu errado. Tente novamente.'

/**
 * Retorna uma mensagem amigável em português a partir do erro da API ou do status HTTP.
 */
export function getUserMessage(apiError: string, status?: number): string {
  const trimmed = (apiError ?? '').trim()

  // Status 429 (rate limit) pode vir sem body ou com statusText "Too Many Requests"
  if (status === 429 || /too many requests/i.test(trimmed)) {
    return MESSAGES['Too Many Requests']
  }

  if (trimmed && MESSAGES[trimmed]) {
    return MESSAGES[trimmed]
  }

  return FALLBACK
}
