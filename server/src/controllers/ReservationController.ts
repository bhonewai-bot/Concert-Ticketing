import { Request, Response, NextFunction } from "express";
import { z } from "zod";
import { ReservationService } from "../services/ReservationService";
import { badRequest } from "../errors";

const service = new ReservationService();

// ─── Validation Schemas ───────────────────────────────────────────────────────

const ReserveSchema = z
  .object({
    concertId: z.string().min(1),
    userId: z.string().min(1),
    category: z.enum(["VIP", "General"]).default("General"),
    simulateFailure: z.boolean().optional(),
  })
  .strict();

// Shared schema for optimistic and pessimistic — no simulateFailure needed
const ReserveLockSchema = z
  .object({
    concertId: z.string().min(1),
    userId: z.string().min(1),
    category: z.enum(["VIP", "General"]).default("General"),
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
    const parsed = ReserveSchema.safeParse(req.body);
    if (!parsed.success)
      throw badRequest("Invalid input", parsed.error.flatten());

    res.status(201).json({ data: await service.reserve(parsed.data) });
  } catch (error) {
    next(error);
  }
}

/**
 * POST /reserve/optimistic
 * Uses @VersionColumn — second concurrent request gets 409 lock_conflict.
 */
export async function reserveOptimistic(
  req: Request,
  res: Response,
  next: NextFunction,
) {
  try {
    const parsed = ReserveLockSchema.safeParse(req.body);
    if (!parsed.success)
      throw badRequest("Invalid input", parsed.error.message);

    res
      .status(201)
      .json({ data: await service.reserveOptimistic(parsed.data) });
  } catch (error) {
    next(error);
  }
}

/**
 * POST /reserve/pessimistic
 * Uses BEGIN IMMEDIATE on SQLite — second concurrent request queues and sees
 * updated state. On PostgreSQL this will use pessimistic_write row lock.
 */
export async function reservePessimistic(
  req: Request,
  res: Response,
  next: NextFunction,
) {
  try {
    const parsed = ReserveLockSchema.safeParse(req.body);
    if (!parsed.success)
      throw badRequest("Invalid input", parsed.error.message);

    res
      .status(201)
      .json({ data: await service.reservePessimistic(parsed.data) });
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
    const parsed = PurchaseSchema.safeParse(req.body);
    if (!parsed.success)
      throw badRequest("Invalid input", parsed.error.message);

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
    res.json({ data: await service.cleanup() });
  } catch (error) {
    next(error);
  }
}
