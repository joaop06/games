import type { FastifyInstance, FastifyRequest, FastifyReply } from "fastify";
import bcrypt from "bcrypt";
import { prisma } from "../lib/db.js";
import {
  setAuthCookies,
  clearAuthCookies,
  signRefreshToken,
  signWsToken,
  verifyRefreshToken,
} from "../lib/auth.js";
import { requireAuth } from "../lib/auth.js";
import { registerSchema, loginSchema } from "../lib/validation.js";

async function authRoutes(fastify: FastifyInstance) {
  const authRateLimit = { config: { rateLimit: { max: 5, timeWindow: "1 minute" } } };
  fastify.post<{
    Body: unknown;
  }>("/api/auth/register", authRateLimit, async (request: FastifyRequest<{ Body: unknown }>, reply: FastifyReply) => {
    const parsed = registerSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.status(400).send({ error: "Validation failed", details: parsed.error.flatten() });
    }
    const { email, username, password } = parsed.data;
    const existing = await prisma.user.findFirst({
      where: { OR: [{ email }, { username }] },
    });
    if (existing) {
      return reply.status(409).send({
        error: existing.email === email ? "Email already in use" : "Username already in use",
      });
    }
    const passwordHash = await bcrypt.hash(password, 12);
    const user = await prisma.user.create({
      data: { email, username, passwordHash },
      select: { id: true, email: true, username: true, createdAt: true },
    });
    setAuthCookies(reply, user.id);
    return reply.status(201).send({
      user: { id: user.id, email: user.email, username: user.username, createdAt: user.createdAt },
    });
  });

  fastify.post<{
    Body: unknown;
  }>("/api/auth/login", authRateLimit, async (request: FastifyRequest<{ Body: unknown }>, reply: FastifyReply) => {
    const parsed = loginSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.status(400).send({ error: "Validation failed", details: parsed.error.flatten() });
    }
    const { email, password } = parsed.data;
    const user = await prisma.user.findUnique({ where: { email } });
    if (!user || !(await bcrypt.compare(password, user.passwordHash))) {
      return reply.status(401).send({ error: "Invalid email or password" });
    }
    setAuthCookies(reply, user.id);
    return reply.send({
      user: {
        id: user.id,
        email: user.email,
        username: user.username,
        createdAt: user.createdAt,
      },
    });
  });

  fastify.get("/api/auth/ws-token", { preHandler: requireAuth }, async (request: FastifyRequest, reply: FastifyReply) => {
    if (!request.userId) return reply.status(401).send({ error: "Unauthorized" });
    return reply.send({ token: signWsToken(request.userId) });
  });

  fastify.post("/api/auth/logout", async (_request, reply: FastifyReply) => {
    clearAuthCookies(reply);
    return reply.send({ ok: true });
  });

  fastify.post<{
    Body: { refreshToken?: string };
  }>("/api/auth/refresh", async (request: FastifyRequest<{ Body: { refreshToken?: string } }>, reply: FastifyReply) => {
    const token = request.cookies?.refreshToken ?? request.body?.refreshToken;
    if (!token) {
      return reply.status(401).send({ error: "Missing refresh token" });
    }
    const payload = verifyRefreshToken(token);
    if (!payload) {
      clearAuthCookies(reply);
      return reply.status(401).send({ error: "Invalid or expired refresh token" });
    }
    const user = await prisma.user.findUnique({
      where: { id: payload.userId },
      select: { id: true, email: true, username: true, createdAt: true },
    });
    if (!user) {
      clearAuthCookies(reply);
      return reply.status(401).send({ error: "User not found" });
    }
    setAuthCookies(reply, user.id);
    return reply.send({
      user: { id: user.id, email: user.email, username: user.username, createdAt: user.createdAt },
    });
  });
}

export default authRoutes;
