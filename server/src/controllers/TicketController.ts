import { Request, Response, NextFunction } from "express";
import { z } from "zod";
import { TicketService } from "../services/TicketService";
import { badRequest } from "../errors";
import { toTicketDTOList } from "../dto/ticket.dto";

const service = new TicketService();

export const CreateTicketsSchema = z
  .object({
    concertId: z.string().min(1),
    category: z.enum(["VIP", "General"]).default("General"),
    quantity: z.int().min(1).max(5),
  })
  .strict();

/**
 * @openapi
 * /tickets:
 *   get:
 *     summary: List tickets
 *     tags: [Tickets]
 *     parameters:
 *       - in: query
 *         name: concertId
 *         schema:
 *           type: string
 *         description: Filter by concert ID
 *     responses:
 *       200:
 *         description: List of tickets (internal_note and version excluded)
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 data:
 *                   type: array
 *                   items:
 *                     $ref: '#/components/schemas/TicketDTO'
 */
export async function listTickets(
  req: Request,
  res: Response,
  next: NextFunction,
) {
  try {
    const concertId = req.query.concertId
      ? String(req.query.concertId)
      : undefined;

    const tickets = await service.listTickets(concertId);
    res.json({ data: toTicketDTOList(tickets) });
  } catch (error) {
    next(error);
  }
}

/**
 * @openapi
 * /tickets:
 *   post:
 *     summary: Create tickets for a concert
 *     tags: [Tickets]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/CreateTicketsBody'
 *     responses:
 *       201:
 *         description: Tickets created
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 data:
 *                   type: array
 *                   items:
 *                     $ref: '#/components/schemas/TicketDTO'
 *       400:
 *         description: Validation error
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 */
export async function createTickets(
  req: Request,
  res: Response,
  next: NextFunction,
) {
  try {
    const parsed = CreateTicketsSchema.safeParse(req.body);
    if (!parsed.success)
      throw badRequest("Invalid input", parsed.error.flatten());

    const tickets = await service.createTickets(parsed.data);
    res.status(201).json({ data: toTicketDTOList(tickets) });
  } catch (error) {
    next(error);
  }
}
