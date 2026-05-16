import { Request, Response, NextFunction } from "express";
import { z } from "zod";
import { ReservationService } from "../services/ReservationService";
import { badRequest } from "../errors";

const service = new ReservationService();

const ReserveSchema = z
  .object({
    concertId: z.string().min(1),
    userId: z.string().min(1),
    category: z.enum(["VIP", "General"]).default("General"),
    simulateFailure: z.boolean().optional(),
  })
  .strict();

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

/**
 * @openapi
 * /reserve:
 *   post:
 *     summary: Reserve a ticket
 *     tags: [Reservations]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/ReserveBody'
 *     responses:
 *       201:
 *         description: Reservation created
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 data:
 *                   $ref: '#/components/schemas/ReservationDTO'
 *       400:
 *         description: Validation error
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *       409:
 *         description: No tickets available
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *       429:
 *         description: Rate limit exceeded (5 requests per minute per IP)
 */
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
 * @openapi
 * /reserve/optimistic:
 *   post:
 *     summary: Reserve a ticket using optimistic locking
 *     description: >
 *       Uses @VersionColumn on the Ticket entity. If two requests race for
 *       the same ticket, the loser receives 409 lock_conflict and must retry.
 *     tags: [Reservations]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/ReserveLockBody'
 *     responses:
 *       201:
 *         description: Reservation created
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 data:
 *                   $ref: '#/components/schemas/ReservationWithMethodDTO'
 *       409:
 *         description: Optimistic lock conflict — ticket modified by another request
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/LockConflictResponse'
 *       429:
 *         description: Rate limit exceeded (5 requests per minute per IP)
 */
export async function reserveOptimistic(
  req: Request,
  res: Response,
  next: NextFunction,
) {
  try {
    const parsed = ReserveLockSchema.safeParse(req.body);
    if (!parsed.success)
      throw badRequest("Invalid input", parsed.error.flatten());

    res
      .status(201)
      .json({ data: await service.reserveOptimistic(parsed.data) });
  } catch (error) {
    next(error);
  }
}

/**
 * @openapi
 * /reserve/pessimistic:
 *   post:
 *     summary: Reserve a ticket using pessimistic locking
 *     description: >
 *       Uses BEGIN IMMEDIATE on SQLite — acquires the write lock at transaction
 *       start so concurrent requests queue rather than conflict. On PostgreSQL
 *       this will use a pessimistic_write row lock.
 *     tags: [Reservations]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/ReserveLockBody'
 *     responses:
 *       201:
 *         description: Reservation created
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 data:
 *                   $ref: '#/components/schemas/ReservationWithMethodDTO'
 *       409:
 *         description: No tickets available (second request saw updated state)
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *       429:
 *         description: Rate limit exceeded (5 requests per minute per IP)
 */
export async function reservePessimistic(
  req: Request,
  res: Response,
  next: NextFunction,
) {
  try {
    const parsed = ReserveLockSchema.safeParse(req.body);
    if (!parsed.success)
      throw badRequest("Invalid input", parsed.error.flatten());

    res
      .status(201)
      .json({ data: await service.reservePessimistic(parsed.data) });
  } catch (error) {
    next(error);
  }
}

/**
 * @openapi
 * /purchase:
 *   post:
 *     summary: Complete a reservation (purchase)
 *     tags: [Reservations]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/PurchaseBody'
 *     responses:
 *       201:
 *         description: Purchase completed
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 data:
 *                   type: object
 *                   properties:
 *                     reservationId:
 *                       type: string
 *                     status:
 *                       type: string
 *                       example: COMPLETED
 *       404:
 *         description: Reservation not found
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *       409:
 *         description: Already completed or expired
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 */
export async function purchase(
  req: Request,
  res: Response,
  next: NextFunction,
) {
  try {
    const parsed = PurchaseSchema.safeParse(req.body);
    if (!parsed.success)
      throw badRequest("Invalid input", parsed.error.flatten());

    res
      .status(201)
      .json({ data: await service.purchase(parsed.data.reservationId) });
  } catch (error) {
    next(error);
  }
}

/**
 * @openapi
 * /cleanup:
 *   post:
 *     summary: Expire stale reservations and release held tickets
 *     tags: [Reservations]
 *     responses:
 *       200:
 *         description: Cleanup result
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 data:
 *                   type: object
 *                   properties:
 *                     expired:
 *                       type: integer
 *                     released:
 *                       type: integer
 */
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
