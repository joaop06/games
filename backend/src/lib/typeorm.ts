import "reflect-metadata";
import { DataSource } from "typeorm";
import {
  User,
  FriendInvite,
  Friendship,
  Notification,
  Match,
  Move,
  UserGameStats,
  FriendGameRecord,
} from "../entities/index.js";

const isDev = process.env.NODE_ENV !== "production";

export const AppDataSource = new DataSource({
  type: "postgres",
  url: process.env.DATABASE_URL,
  synchronize: false,
  logging: isDev ? ["error", "warn", "schema"] : ["error"],
  migrations: ["dist/migrations/*.js"],
  entities: [
    User,
    FriendInvite,
    Friendship,
    Notification,
    Match,
    Move,
    UserGameStats,
    FriendGameRecord,
  ],
});

export async function initDataSource(): Promise<DataSource> {
  if (!AppDataSource.isInitialized) {
    await AppDataSource.initialize();
  }
  return AppDataSource;
}
