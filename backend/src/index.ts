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

const app = Fastify({ logger: true });

const { initDataSource, AppDataSource } = await import("./lib/typeorm.js");
await initDataSource();
try {
  await AppDataSource.runMigrations();
  app.log.info("Migrations completed");
} catch (err) {
  app.log.error(err, "Migrations failed");
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
} catch (err) {
  app.log.error(err);
  process.exit(1);
}
