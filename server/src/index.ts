import "reflect-metadata";
import express from "express";
import { initialzeDataSource } from "./config/data-source";
import { logger } from "./lib/logger";
import { correlationIdMiddleware } from "./middleware/correlationId";
import { globalErrorHandler } from "./middleware/errorHandler";
import { getConcert, listConcerts } from "./controllers/ConcertController";
import {
  cleanup,
  purchase,
  reserve,
} from "./controllers/ReservationController";

// INITIALIZE EXPRESS
const app = express();
app.use(express.json());

// CORRELATION ID — must be first so every subsequent log carries the ID
app.use(correlationIdMiddleware);

// ROUTES
app.get("/concerts", listConcerts);
app.get("/concerts/:id", getConcert);
app.post("/reserve", reserve);
app.post("/purchase", purchase);
app.post("/cleanup", cleanup);

// GLOBAL ERROR HANDLER — must be last
app.use(globalErrorHandler);

// START SERVER
const PORT = Number(process.env.PORT) || 3000;

initialzeDataSource().then(() => {
  logger.info(`Server running on http://localhost:${PORT}`);
  app.listen(PORT);
});
