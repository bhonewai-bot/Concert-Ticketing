import { Ticket } from "../entities/Ticket";

/**
 * Public-safe shape of a Ticket.
 * Deliberately excludes `internal_note` and `version` — these must never
 * be exposed in API responses even if they are added to the entity later
 * (e.g. @VersionColumn in Part 3).
 */
export interface TicketDTO {
  id: string;
  concertId: string;
  category: "VIP" | "General";
  status: "AVAILABLE" | "HELD" | "SOLD";
  reservationId: string | null;
  createdAt: Date;
}

export function toTicketDTO(ticket: Ticket): TicketDTO {
  return {
    id: ticket.id,
    concertId: ticket.concertId,
    category: ticket.category,
    status: ticket.status,
    reservationId: ticket.reservationId,
    createdAt: ticket.createdAt,
  };
}

export function toTicketDTOList(tickets: Ticket[]): TicketDTO[] {
  return tickets.map(toTicketDTO);
}
