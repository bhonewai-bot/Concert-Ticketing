import { AsyncLocalStorage } from "async_hooks";
import pino from "pino";

// ─── Async Context Store ──────────────────────────────────────────────────────
// Holds per-request data (currently just correlationId).
// Any code that runs within a request context can call getCorrelationId()
// without needing it passed as a parameter.

interface RequestContext {
  correlationId: string;
}

export const asyncLocalStorage = new AsyncLocalStorage<RequestContext>();

export function getCorrelationId(): string | undefined {
  return asyncLocalStorage.getStore()?.correlationId;
}

// ─── Pino Logger ─────────────────────────────────────────────────────────────
// Uses a `mixin` so every log line automatically includes the correlationId
// from the current async context — no manual passing required.

export const logger = pino(
  {
    level: process.env.LOG_LEVEL ?? "info",
    // Automatically merge correlationId into every log record
    mixin() {
      const correlationId = getCorrelationId();
      return correlationId ? { correlationId } : {};
    },
    timestamp: pino.stdTimeFunctions.isoTime,
  },
  // Pretty-print in development, plain JSON in production
  process.env.NODE_ENV !== "production"
    ? pino.transport({ target: "pino-pretty", options: { colorize: true } })
    : undefined,
);
