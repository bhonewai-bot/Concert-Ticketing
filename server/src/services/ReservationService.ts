import { DataSource } from "typeorm";
import { AppDataSource } from "../config/data-source";
import { Concert } from "../entities/Concert";
import { Ticket } from "../entities/Ticket";
import { Reservation } from "../entities/Reservation";
import { conflict, notFound } from "../errors";
import { TicketService } from "./TicketService";

const ticketService = new TicketService();

function addMinutes(date: Date, minutes: number): Date {
  return new Date(date.getTime() + minutes * 60_000);
}

export class ReservationService {
  constructor(private datasource: DataSource = AppDataSource) {}

  async reserve(input: {
    concertId: string;
    userId: string;
    category: "VIP" | "General";
    simulateFailure?: boolean;
  }) {
    // INITIALIZE TRANSACTION
    const queryRunner = this.datasource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      // INITIALIZE REPOSITORIES
      const concertRepo = queryRunner.manager.getRepository(Concert);
      const ticketRepo = queryRunner.manager.getRepository(Ticket);
      const reservationRepo = queryRunner.manager.getRepository(Reservation);

      // VALIDATE CONCERT AND STOCK
      const concert = await concertRepo.findOneBy({ id: input.concertId });
      if (!concert) throw notFound("Concert not found");
      if (concert.availableStock <= 0) throw conflict("No tickets available");

      // FIND AVAILABLE TICKET
      const ticket = await ticketService.getAvailableTicket(
        queryRunner.manager,
        input.concertId,
        input.category,
      );
      if (!ticket) throw conflict("No available ticket for this category");

      // DECREMENT STOCK
      concert.availableStock -= 1;
      await concertRepo.save(concert);

      // SIMULATE FAILURE FOR ROLLBACK PROOF
      // Throws after stock is decremented but before reservation is saved.
      // The catch block rolls back — proving stock is restored atomically.
      if (input.simulateFailure)
        throw new Error("Simulated failure - stock must roll back");

      // CREATE RESERVATION
      const reservation = reservationRepo.create({
        id: crypto.randomUUID(),
        concertId: input.concertId,
        ticketId: ticket.id,
        userId: input.userId,
        status: "PENDING",
        expiresAt: addMinutes(new Date(), 5),
        createdAt: new Date(),
      });
      await reservationRepo.save(reservation);

      // HOLD TICKET
      ticket.status = "HELD";
      ticket.reservationId = reservation.id;
      await ticketRepo.save(ticket);

      // COMMIT TRANSACTION
      await queryRunner.commitTransaction();

      // RETURN RESULT
      return {
        reservationId: reservation.id,
        ticketId: ticket.id,
        expiresAt: reservation.expiresAt,
      };
    } catch (error) {
      // ROLLBACK ON FAILURE
      await queryRunner.rollbackTransaction();
      throw error;
    } finally {
      await queryRunner.release();
    }
  }

  async purchase(reservationId: string) {
    // INITIALIZE TRANSACTION
    const queryRunner = this.datasource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      // INITIALIZE REPOSITORIES
      const reservationRepo = queryRunner.manager.getRepository(Reservation);
      const ticketRepo = queryRunner.manager.getRepository(Ticket);

      // VALIDATE RESERVATION
      const reservation = await reservationRepo.findOneBy({
        id: reservationId,
      });
      if (!reservation) throw notFound("Reservation not found");
      if (reservation.status === "COMPLETED")
        throw conflict("Already completed");
      if (reservation.status === "EXPIRED")
        throw conflict("Reservation expired");
      if (reservation.expiresAt <= new Date())
        throw conflict("Reservation expired");

      // COMPLETE RESERVATION
      reservation.status = "COMPLETED";
      await reservationRepo.save(reservation);

      // MARK TICKET AS SOLD
      const ticket = await ticketRepo.findOneBy({ id: reservation.ticketId });
      if (ticket) {
        ticket.status = "SOLD";
        await ticketRepo.save(ticket);
      }

      // COMMIT TRANSACTION
      await queryRunner.commitTransaction();

      // RETURN RESULT
      return { reservationId, status: "COMPLETED" };
    } catch (error) {
      // ROLLBACK ON FAILURE
      await queryRunner.rollbackTransaction();
      throw error;
    } finally {
      await queryRunner.release();
    }
  }

  async cleanup(limit = 100) {
    // FETCH EXPIRED PENDING RESERVATIONS
    const expired = await this.datasource
      .getRepository(Reservation)
      .createQueryBuilder("r")
      .where("r.status = 'PENDING' AND r.expires_at <= :now", {
        now: new Date(),
      })
      .take(limit)
      .getMany();

    if (expired.length === 0) return { expired: 0, released: 0 };

    // INITIALIZE TRANSACTION
    const queryRunner = this.datasource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      // INITIALIZE REPOSITORIES
      const reservationRepo = queryRunner.manager.getRepository(Reservation);
      const ticketRepo = queryRunner.manager.getRepository(Ticket);
      const concertRepo = queryRunner.manager.getRepository(Concert);
      let released = 0;

      for (const r of expired) {
        // RE-CHECK STATUS INSIDE TRANSACTION (PREVENT DOUBLE-PROCESSING)
        const reservation = await reservationRepo.findOneBy({
          id: r.id,
          status: "PENDING",
        });
        if (!reservation) continue;

        // EXPIRE RESERVATION
        reservation.status = "EXPIRED";
        await reservationRepo.save(reservation);

        // RELEASE TICKET AND RESTORE STOCK
        const ticket = await ticketRepo.findOneBy({ id: reservation.ticketId });
        if (ticket && ticket.status === "HELD") {
          ticket.status = "AVAILABLE";
          ticket.reservationId = null;
          await ticketRepo.save(ticket);

          const concert = await concertRepo.findOneBy({
            id: reservation.concertId,
          });
          if (concert) {
            concert.availableStock += 1;
            await concertRepo.save(concert);
          }

          released += 1;
        }
      }

      // COMMIT TRANSACTION
      await queryRunner.commitTransaction();

      // RETURN RESULT
      return { expired: expired.length, released };
    } catch (error) {
      // ROLLBACK ON FAILURE
      await queryRunner.rollbackTransaction();
      throw error;
    } finally {
      await queryRunner.release();
    }
  }
}
