import "reflect-metadata";
import express from "express";
import swaggerUi from "swagger-ui-express";
import { initialzeDataSource } from "./config/data-source";
import { AppDataSource } from "./config/data-source";
import { logger } from "./lib/logger";
import { swaggerSpec } from "./lib/swagger";
import { correlationIdMiddleware } from "./middleware/correlationId";
import { globalErrorHandler } from "./middleware/errorHandler";
import { reserveRateLimiter } from "./middleware/rateLimiter";
import { getConcert, listConcerts } from "./controllers/ConcertController";
import {
  cleanup,
  purchase,
  reserve,
  reserveOptimistic,
  reservePessimistic,
} from "./controllers/ReservationController";
import { listTickets, createTickets } from "./controllers/TicketController";

// ─── App ──────────────────────────────────────────────────────────────────────
const app = express();
app.use(express.json());

// CORRELATION ID — must be first so every subsequent log carries the ID
app.use(correlationIdMiddleware);

// ─── Swagger UI ───────────────────────────────────────────────────────────────
app.use("/docs", swaggerUi.serve, swaggerUi.setup(swaggerSpec));

// ─── API v1 Routes ───────────────────────────────────────────────────────────────────
const v1 = express.Router();
app.get("/health", (_req, res) => {
  res.json({ status: "ok", timestamp: new Date().toISOString() });
});

v1.get("/concerts", listConcerts);
v1.get("/concerts/:id", getConcert);

v1.get("/tickets", listTickets);
v1.post("/tickets", createTickets);

// Rate limited: 5 requests per minute per IP
v1.post("/reserve", reserveRateLimiter, reserve);
v1.post("/reserve/optimistic", reserveRateLimiter, reserveOptimistic);
v1.post("/reserve/pessimistic", reserveRateLimiter, reservePessimistic);

v1.post("/purchase", purchase);
v1.post("/cleanup", cleanup);

app.use("/api/v1", v1);

// GLOBAL ERROR HANDLER — must be last
app.use(globalErrorHandler);

// ─── Start ────────────────────────────────────────────────────────────────────
const PORT = Number(process.env.PORT) || 3000;

initialzeDataSource().then(() => {
  const server = app.listen(PORT, () => {
    logger.info(`Server running on http://localhost:${PORT}`);
    logger.info(`Swagger UI available at http://localhost:${PORT}/api-docs`);
  });

  // ─── Graceful Shutdown (SIGTERM) ───────────────────────────────────────────
  // 1. Stop accepting new connections.
  // 2. Wait up to 5 seconds for pending DB queries to finish.
  // 3. Destroy the DataSource and exit.

  process.on("SIGTERM", () => {
    logger.info("SIGTERM received — starting graceful shutdown");

    server.close(async () => {
      logger.info("HTTP server closed — waiting for DB queries to settle");

      const shutdownTimeout = setTimeout(() => {
        logger.warn("Shutdown timeout reached — forcing exit");
        process.exit(1);
      }, 5000);

      try {
        if (AppDataSource.isInitialized) {
          await AppDataSource.destroy();
          logger.info("DataSource destroyed — exiting cleanly");
        }
        clearTimeout(shutdownTimeout);
        process.exit(0);
      } catch (err) {
        logger.error({ err }, "Error during DataSource shutdown");
        clearTimeout(shutdownTimeout);
        process.exit(1);
      }
    });
  });
});
