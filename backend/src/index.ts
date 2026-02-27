import "reflect-metadata";
import Fastify from "fastify";
import cookie from "@fastify/cookie";
import cors from "@fastify/cors";
import rateLimit from "@fastify/rate-limit";
import websocket from "@fastify/websocket";
import authRoutes from "./routes/auth.js";
import userRoutes from "./routes/users.js";
import friendRoutes from "./routes/friends.js";
import notificationRoutes from "./routes/notifications.js";
import ticTacToeRoutes from "./routes/games/tic-tac-toe.js";
import { registerWebSocket } from "./ws/handler.js";
import { buildRequestErrorContext } from "./lib/logger.js";

const app = Fastify({
  logger: true,
  requestIdHeader: "x-request-id",
  requestIdLogLabel: "reqId",
});

app.setErrorHandler((err: Error & { statusCode?: number; details?: unknown }, request, reply) => {
  const routePattern = (request as { routeOptions?: { url?: string } }).routeOptions?.url ?? request.url;
  const statusCode = err.statusCode ?? 500;
  const errorPayload = { error: err.message, details: err.details };
  const ctx = buildRequestErrorContext(
    {
      method: request.method,
      url: request.url,
      params: request.params,
      query: request.query,
      body: request.body,
      userId: request.userId,
    },
    routePattern,
    statusCode,
    errorPayload,
    err
  );
  request.log.error({ ...ctx, msg: "Request error (uncaught)" }, err.message);
  const isProd = process.env.NODE_ENV === "production";
  reply.status(statusCode).send({
    error: statusCode >= 500 && isProd ? "Internal server error" : err.message,
    ...(statusCode < 500 || !isProd ? { details: err.details } : {}),
  });
});

app.addHook("onSend", (request, reply, payload, done) => {
  const statusCode = reply.statusCode;
  if (statusCode >= 400) {
    let errorPayload: { error?: string; details?: unknown } = {};
    try {
      const raw = typeof payload === "string" ? payload : (payload as Buffer)?.toString?.();
      if (raw) errorPayload = JSON.parse(raw) as { error?: string; details?: unknown };
    } catch {
      errorPayload = { error: String(payload).slice(0, 200) };
    }
    const routePattern = (request as { routeOptions?: { url?: string } }).routeOptions?.url ?? request.url;
    const ctx = buildRequestErrorContext(
      {
        method: request.method,
        url: request.url,
        params: request.params,
        query: request.query,
        body: request.body,
        userId: request.userId,
      },
      routePattern,
      statusCode,
      errorPayload
    );
    const logLevel = statusCode >= 500 ? "error" : "warn";
    request.log[logLevel]({ ...ctx, msg: "Request error" });
  }
  done(null, payload);
});

const { initDataSource, AppDataSource } = await import("./lib/typeorm.js");
await initDataSource();
try {
  await AppDataSource.runMigrations();
  app.log.info("Migrations completed");
} catch (err: unknown) {
  app.log.error(err instanceof Error ? err : new Error(String(err)), "Migrations failed");
  process.exit(1);
}

await app.register(cookie, { secret: process.env.JWT_SECRET ?? "cookie-secret" });
await app.register(cors, {
  origin: process.env.CORS_ORIGIN ?? "http://localhost:5173",
  credentials: true,
});
await app.register(rateLimit, {
  max: 100,
  timeWindow: "1 minute",
});

await app.register(websocket);
await app.register(authRoutes);
await app.register(userRoutes);
await app.register(friendRoutes);
await app.register(notificationRoutes);
await app.register(ticTacToeRoutes);
await registerWebSocket(app);

app.get("/health", async () => ({ status: "ok" }));

const host = process.env.HOST ?? "0.0.0.0";
const port = Number(process.env.PORT ?? 3000);

try {
  await app.listen({ host, port });
} catch (err: unknown) {
  app.log.error(err instanceof Error ? err : new Error(String(err)));
  process.exit(1);
}
