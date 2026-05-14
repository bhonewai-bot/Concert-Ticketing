import { Request, Response, NextFunction } from "express";
import { z } from "zod";
import { TicketService } from "../services/TicketService";
import { badRequest } from "../errors";
import { toTicketDTOList } from "../dto/ticket.dto";

const service = new TicketService();

// ─── Validation Schemas ───────────────────────────────────────────────────────

/**
 * .strict() rejects any unknown properties in the request body.
 * quantity must be an integer between 1 and 5.
 */
export const CreateTicketsSchema = z
  .object({
    concertId: z.string().min(1),
    category: z.enum(["VIP", "General"]).default("General"),
    quantity: z.int().min(1).max(5),
  })
  .strict();

// ─── Handlers ─────────────────────────────────────────────────────────────────

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

    // SERIALIZE — never expose internal_note or version
    res.json({ data: toTicketDTOList(tickets) });
  } catch (error) {
    next(error);
  }
}

export async function createTickets(
  req: Request,
  res: Response,
  next: NextFunction,
) {
  try {
    // VALIDATE — strict schema rejects unknown fields
    const parsed = CreateTicketsSchema.safeParse(req.body);
    if (!parsed.success)
      throw badRequest("Invalid input", parsed.error.message);

    const tickets = await service.createTickets(parsed.data);

    // SERIALIZE — never expose internal_note or version
    res.status(201).json({ data: toTicketDTOList(tickets) });
  } catch (error) {
    next(error);
  }
}
