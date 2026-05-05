import { DataSource, EntityManager } from "typeorm";
import { AppDataSource } from "../config/data-source";
import { Ticket } from "../entities/Ticket";

export class TicketService {
  constructor(private datasource: DataSource = AppDataSource) {}

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
}
