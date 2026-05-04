import "reflect-metadata";
import express, { Request, Response, NextFunction } from "express";
import { HttpError } from "./errors";
import { initialzeDataSource } from "./config/data-source";

const app = express();
app.use(express.Router());

app.use((err: unknown, _req: Request, res: Response, _next: NextFunction) => {
  if (err instanceof HttpError) {
    return res.status(err.status).json({
      error: { code: err.code, message: err.message, details: err.details },
    });
  }
  console.error(err);
  return res.status(500).json({
    error: { code: "internal_error", message: "Internal server error" },
  });
});

const PORT = Number(process.env.PORT) || 3000;

initialzeDataSource().then(() => {
  app.listen(PORT, () =>
    console.log(`Server running on http://localhost:${PORT}`),
  );
});
