import type { FastifyInstance, FastifyRequest, FastifyReply } from "fastify";
import { getRepository } from "../lib/db.js";
import { User } from "../entities/User.js";
import { requireAuth } from "../lib/auth.js";
import { normalizeUsernameRaw, checkUsernameQuerySchema } from "../lib/validation.js";

async function userRoutes(fastify: FastifyInstance) {
  fastify.get<{ Querystring: unknown }>(
    "/api/users/check-username",
    async (request: FastifyRequest<{ Querystring: unknown }>, reply: FastifyReply) => {
      const parsed = checkUsernameQuerySchema.safeParse(request.query);
      const normalized = parsed.success ? parsed.data.username : "";
      if (normalized.length < 2 || normalized.length > 32 || !/^[a-z0-9]+$/.test(normalized)) {
        return reply.send({ exists: false });
      }
      const user = await getRepository(User).findOne({ where: { username: normalized } });
      return reply.send({ exists: !!user });
    }
  );

  fastify.get("/api/users/me", { preHandler: requireAuth }, async (request: FastifyRequest, reply: FastifyReply) => {
    if (!request.userId) return reply.status(401).send({ error: "Unauthorized" });
    const user = await getRepository(User).findOne({
      where: { id: request.userId! },
      select: { id: true, username: true, createdAt: true, updatedAt: true },
    });
    if (!user) return reply.status(404).send({ error: "User not found" });
    return reply.send(user);
  });

  fastify.patch<{
    Body: { username?: string };
  }>(
    "/api/users/me",
    { preHandler: requireAuth },
    async (request: FastifyRequest<{ Body: { username?: string } }>, reply: FastifyReply) => {
      if (!request.userId) return reply.status(401).send({ error: "Unauthorized" });
      const { username } = request.body ?? {};
      if (username !== undefined) {
        const normalized = typeof username === "string" ? normalizeUsernameRaw(username) : "";
        if (normalized.length < 2 || normalized.length > 32 || !/^[a-z0-9]+$/.test(normalized)) {
          return reply.status(400).send({ error: "Invalid username" });
        }
        const existing = await getRepository(User).findOne({ where: { username: normalized } });
        if (existing && existing.id !== request.userId) {
          return reply.status(409).send({ error: "Username already in use" });
        }
        await getRepository(User).update({ id: request.userId! }, { username: normalized });
      }
      const user = await getRepository(User).findOne({
        where: { id: request.userId! },
        select: { id: true, username: true, createdAt: true, updatedAt: true },
      });
      return reply.send(user!);
    }
  );
}

export default userRoutes;
