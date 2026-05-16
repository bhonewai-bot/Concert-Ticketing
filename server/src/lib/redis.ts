import Redis from "ioredis";
import { logger } from "./logger";

export const redisClient = new Redis(
  process.env.REDIS_URL ?? "redis://localhost:6379",
  {
    lazyConnect: true,
    // Allow queuing commands while connecting — fixes rate-limit-redis init error
    enableOfflineQueue: true,
    maxRetriesPerRequest: 3,
  },
);

redisClient.on("connect", () => logger.info("Redis connected"));
redisClient.on("error", (err) => logger.warn({ err }, "Redis error"));
