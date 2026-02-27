/**
 * Sanitiza objetos para não logar valores sensíveis (senha, tokens, etc.).
 */
const SENSITIVE_KEYS = new Set([
  "password",
  "passwordHash",
  "accessToken",
  "refreshToken",
  "token",
  "cookie",
  "authorization",
  "cookie",
]);
const REDACTED = "[REDACTED]";

function sanitizeValue(value: unknown): unknown {
  if (value === null || value === undefined) return value;
  if (typeof value === "object" && !Array.isArray(value) && value !== null) {
    return sanitizeObject(value as Record<string, unknown>);
  }
  if (Array.isArray(value)) {
    return value.map(sanitizeValue);
  }
  return value;
}

export function sanitizeObject<T extends Record<string, unknown>>(obj: T): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [key, val] of Object.entries(obj)) {
    const keyLower = key.toLowerCase();
    if (SENSITIVE_KEYS.has(keyLower) || keyLower.includes("token") || keyLower.includes("password")) {
      out[key] = val != null && String(val).length > 0 ? REDACTED : val;
    } else {
      out[key] = sanitizeValue(val);
    }
  }
  return out;
}

/**
 * Sanitiza body/query/params para log (pode ser objeto ou undefined).
 */
export function sanitizeForLog(value: unknown): Record<string, unknown> | undefined {
  if (value === null || value === undefined) return undefined;
  if (typeof value === "object" && !Array.isArray(value)) {
    return sanitizeObject(value as Record<string, unknown>);
  }
  return undefined;
}

export type RequestErrorContext = {
  method: string;
  url: string;
  route: string;
  params: Record<string, unknown>;
  query: Record<string, unknown>;
  body: Record<string, unknown> | undefined;
  userId: string | undefined;
  statusCode: number;
  errorMessage: string;
  errorDetails?: unknown;
  err?: { type: string; message: string; stack?: string };
};

/**
 * Monta o objeto de contexto de erro para log a partir do request e da resposta.
 */
export function buildRequestErrorContext(
  request: { method: string; url: string; params?: unknown; query?: unknown; body?: unknown; userId?: string },
  routePattern: string,
  statusCode: number,
  errorPayload: { error?: string; details?: unknown },
  err?: Error
): RequestErrorContext {
  const ctx: RequestErrorContext = {
    method: request.method,
    url: request.url,
    route: routePattern,
    params: sanitizeForLog(request.params) ?? {},
    query: sanitizeForLog(request.query) ?? {},
    body: sanitizeForLog(request.body),
    userId: request.userId,
    statusCode,
    errorMessage: errorPayload.error ?? "Unknown error",
    errorDetails: errorPayload.details,
  };
  if (err) {
    ctx.err = {
      type: err.name,
      message: err.message,
      stack: err.stack,
    };
  }
  return ctx;
}
