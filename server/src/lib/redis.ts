import Redis from "ioredis";
import { logger } from "./logger";

/**
 * Shared ioredis client.
 * REDIS_URL defaults to localhost:6379 if not set in .env.
 */
export const redisClient = new Redis(
  process.env.REDIS_URL ?? "redis://localhost:6379",
  {
    // Do not crash the process on connection failure — rate limiter will
    // degrade gracefully if Redis is unreachable.
    lazyConnect: true,
    enableOfflineQueue: false,
  },
);

redisClient.on("connect", () => logger.info("Redis connected"));
redisClient.on("error", (err) => logger.warn({ err }, "Redis error"));
