import { DataSource, EntityManager } from "typeorm";
import { AppDataSource } from "../config/data-source";
import { Ticket } from "../entities/Ticket";

export class TicketService {
  constructor(private datasource: DataSource = AppDataSource) {}

  // ─── Used internally by ReservationService ──────────────────────────────────

  async getAvailableTicket(
    manager: EntityManager,
    concertId: string,
    category: "VIP" | "General",
  ): Promise<Ticket | null> {
    // FIND FIRST AVAILABLE TICKET BY CONCERT AND CATEGORY
    return await manager.getRepository(Ticket).findOne({
      where: { concertId, category, status: "AVAILABLE" },
      order: { createdAt: "ASC" },
    });
  }

  // ─── GET /tickets ────────────────────────────────────────────────────────────

  async listTickets(concertId?: string): Promise<Ticket[]> {
    const tickets = this.datasource.getRepository(Ticket);

    if (concertId) {
      return tickets.findBy({ concertId });
    }

    return tickets.find({ order: { createdAt: "ASC" } });
  }

  // ─── POST /tickets ───────────────────────────────────────────────────────────

  async createTickets(input: {
    concertId: string;
    category: "VIP" | "General";
    quantity: number;
  }): Promise<Ticket[]> {
    const repo = this.datasource.getRepository(Ticket);

    const tickets = Array.from({ length: input.quantity }, () =>
      repo.create({
        id: crypto.randomUUID(),
        concertId: input.concertId,
        category: input.category,
        status: "AVAILABLE",
        reservationId: null,
        createdAt: new Date(),
      }),
    );

    return repo.save(tickets);
  }
}
