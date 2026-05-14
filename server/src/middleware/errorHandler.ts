import { Request, Response, NextFunction } from "express";
import { HttpError } from "../errors";
import { getCorrelationId, logger } from "../lib/logger";

/**
 * Global Error Middleware (Part 1 – Day 3)
 *
 * • Logs the full stack trace and correlationId.
 * • Returns a clean JSON body:
 *     { "error": "CODE", "message": "User friendly message", "ref": "<correlationId>" }
 *
 * Must be registered AFTER all routes (4-argument signature tells Express this
 * is an error handler).
 */
export function globalErrorHandler(
  err: unknown,
  _req: Request,
  res: Response,
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  _next: NextFunction,
): void {
  const ref = getCorrelationId() ?? "unknown";

  if (err instanceof HttpError) {
    logger.warn({ err, ref, statusCode: err.status }, "HTTP error");

    res.status(err.status).json({
      error: err.code,
      message: err.message,
      ref,
    });
    return;
  }

  // Unexpected / unhandled errors
  logger.error({ err, ref }, "Unhandled error");

  res.status(500).json({
    error: "internal_error",
    message: "Internal server error",
    ref,
  });
}
