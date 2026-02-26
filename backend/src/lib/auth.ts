import jwt from "jsonwebtoken";
import type { FastifyRequest, FastifyReply } from "fastify";
import { prisma } from "./db.js";

declare module "fastify" {
  interface FastifyRequest {
    userId?: string;
  }
}

const JWT_SECRET = process.env.JWT_SECRET ?? "dev-secret-change-in-production";
// TTL in seconds: 15 min, 7 days, 2 min for WS
const ACCESS_TTL_SEC = 15 * 60;
const REFRESH_TTL_SEC = 7 * 24 * 60 * 60;
const WS_TTL_SEC = 2 * 60;

const COOKIE_ACCESS = "accessToken";
const COOKIE_REFRESH = "refreshToken";

export type TokenPayload = { userId: string; type: "access" | "refresh" | "ws" };

export function signAccessToken(userId: string): string {
  return jwt.sign(
    { userId, type: "access" } as TokenPayload,
    JWT_SECRET,
    { expiresIn: ACCESS_TTL_SEC }
  );
}

export function signRefreshToken(userId: string): string {
  return jwt.sign(
    { userId, type: "refresh" } as TokenPayload,
    JWT_SECRET,
    { expiresIn: REFRESH_TTL_SEC }
  );
}

export function signWsToken(userId: string): string {
  return jwt.sign(
    { userId, type: "ws" } as TokenPayload,
    JWT_SECRET,
    { expiresIn: WS_TTL_SEC }
  );
}

export function verifyAccessToken(token: string): TokenPayload | null {
  try {
    const payload = jwt.verify(token, JWT_SECRET) as TokenPayload;
    return payload.type === "access" ? payload : null;
  } catch {
    return null;
  }
}

export function verifyRefreshToken(token: string): TokenPayload | null {
  try {
    const payload = jwt.verify(token, JWT_SECRET) as TokenPayload;
    return payload.type === "refresh" ? payload : null;
  } catch {
    return null;
  }
}

export function verifyWsToken(token: string): TokenPayload | null {
  try {
    const payload = jwt.verify(token, JWT_SECRET) as TokenPayload;
    return payload.type === "ws" ? payload : null;
  } catch {
    return null;
  }
}

export function setAuthCookies(reply: FastifyReply, userId: string) {
  const access = signAccessToken(userId);
  const refresh = signRefreshToken(userId);
  const isProd = process.env.NODE_ENV === "production";
  reply.setCookie(COOKIE_ACCESS, access, {
    httpOnly: true,
    secure: isProd,
    sameSite: "lax",
    path: "/",
    maxAge: ACCESS_TTL_SEC,
  });
  reply.setCookie(COOKIE_REFRESH, refresh, {
    httpOnly: true,
    secure: isProd,
    sameSite: "lax",
    path: "/",
    maxAge: REFRESH_TTL_SEC,
  });
}

export function clearAuthCookies(reply: FastifyReply) {
  reply.clearCookie(COOKIE_ACCESS, { path: "/" });
  reply.clearCookie(COOKIE_REFRESH, { path: "/" });
}

export async function authenticate(
  request: FastifyRequest,
  reply: FastifyReply
): Promise<{ userId: string } | null> {
  const access = request.cookies?.[COOKIE_ACCESS];
  if (access) {
    const payload = verifyAccessToken(access);
    if (payload) return { userId: payload.userId };
  }
  const refresh = request.cookies?.[COOKIE_REFRESH];
  if (refresh) {
    const payload = verifyRefreshToken(refresh);
    if (payload) {
      const user = await prisma.user.findUnique({
        where: { id: payload.userId },
        select: { id: true },
      });
      if (user) {
        setAuthCookies(reply, user.id);
        return { userId: user.id };
      }
    }
  }
  return null;
}

export async function requireAuth(
  request: FastifyRequest,
  reply: FastifyReply
): Promise<void> {
  const auth = await authenticate(request, reply);
  if (!auth) {
    reply.status(401).send({ error: "Unauthorized" });
    return;
  }
  request.userId = auth.userId;
}
