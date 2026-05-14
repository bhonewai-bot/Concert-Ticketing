import rateLimit from "express-rate-limit";
import { RedisStore, type RedisReply } from "rate-limit-redis";
import { redisClient } from "../lib/redis";

/**
 * Rate Limiter — /reserve endpoint
 * 5 requests per minute per IP, backed by Redis.
 */
export const reserveRateLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  limit: 5,
  standardHeaders: "draft-8",
  legacyHeaders: false,
  store: new RedisStore({
    sendCommand: (command: string, ...args: string[]) =>
      redisClient.call(command, ...args) as Promise<RedisReply>,
  }),
  message: {
    error: "too_many_requests",
    message: "Too many reservation attempts. Please try again in a minute.",
  },
});
