import { Request, Response, NextFunction } from "express";
import { z } from "zod";
import { ReservationService } from "../services/ReservationService";
import { badRequest } from "../errors";

const service = new ReservationService();

// ─── Validation Schemas ───────────────────────────────────────────────────────

/**
 * .strict() rejects any unknown properties sent in the request body.
 */
const ReserveSchema = z
  .object({
    concertId: z.string().min(1),
    userId: z.string().min(1),
    category: z.enum(["VIP", "General"]).default("General"),
    simulateFailure: z.boolean().optional(),
  })
  .strict();

const PurchaseSchema = z
  .object({
    reservationId: z.string().min(1),
  })
  .strict();

// ─── Handlers ─────────────────────────────────────────────────────────────────

export async function reserve(req: Request, res: Response, next: NextFunction) {
  try {
    // VALIDATE REQUEST BODY
    const parsed = ReserveSchema.safeParse(req.body);
    if (!parsed.success)
      throw badRequest("Invalid input", parsed.error.message);

    // RETURN RESULT
    res.status(201).json({ data: await service.reserve(parsed.data) });
  } catch (error) {
    next(error);
  }
}

export async function purchase(
  req: Request,
  res: Response,
  next: NextFunction,
) {
  try {
    // VALIDATE REQUEST BODY
    const parsed = PurchaseSchema.safeParse(req.body);
    if (!parsed.success)
      throw badRequest("Invalid input", parsed.error.message);

    // RETURN RESULT
    res
      .status(201)
      .json({ data: await service.purchase(parsed.data.reservationId) });
  } catch (error) {
    next(error);
  }
}

export async function cleanup(
  _req: Request,
  res: Response,
  next: NextFunction,
) {
  try {
    // RUN CLEANUP AND RETURN RESULT
    res.json({ data: await service.cleanup() });
  } catch (error) {
    next(error);
  }
}
