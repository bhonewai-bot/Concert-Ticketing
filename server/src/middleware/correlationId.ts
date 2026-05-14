import { Request, Response, NextFunction } from "express";
import { asyncLocalStorage, logger } from "../lib/logger";

/**
 * Correlation ID Middleware
 *
 * 1. Reads X-Correlation-ID from the incoming request header.
 * 2. Falls back to a freshly generated UUID if the header is absent.
 * 3. Runs the rest of the request pipeline inside AsyncLocalStorage so every
 *    log call automatically includes the correlationId without prop-drilling.
 * 4. Echoes the correlationId back in the response header.
 */
export function correlationIdMiddleware(
  req: Request,
  res: Response,
  next: NextFunction,
): void {
  const correlationId =
    (req.headers["x-correlation-id"] as string | undefined) ??
    crypto.randomUUID();

  // Echo back so clients can trace their own requests
  res.setHeader("X-Correlation-ID", correlationId);

  // Run everything downstream inside the async context
  asyncLocalStorage.run({ correlationId }, () => {
    logger.info({ method: req.method, url: req.url }, "Request received");
    next();
  });
}
