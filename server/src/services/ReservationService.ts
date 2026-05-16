import { DataSource } from "typeorm";
import { OptimisticLockVersionMismatchError } from "typeorm";
import { AppDataSource } from "../config/data-source";
import { Concert } from "../entities/Concert";
import { Ticket } from "../entities/Ticket";
import { Reservation } from "../entities/Reservation";
import { conflict, lockConflict, notFound } from "../errors";
import { TicketService } from "./TicketService";

const ticketService = new TicketService();

function addMinutes(date: Date, minutes: number): Date {
  return new Date(date.getTime() + minutes * 60_000);
}

// ─── Shared reservation builder ───────────────────────────────────────────────
// Runs inside an already-open queryRunner transaction.
// Used by: reserve() and reservePessimistic()

async function buildReservation(
  queryRunner: ReturnType<DataSource["createQueryRunner"]>,
  input: {
    concertId: string;
    userId: string;
    category: "VIP" | "General";
    simulateFailure?: boolean;
  },
) {
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

  // ATOMIC STOCK DECREMENT
  const updateResult = await concertRepo
    .createQueryBuilder()
    .update(Concert)
    .set({ availableStock: () => "available_stock - 1" })
    .where("id = :id AND available_stock > 0", { id: input.concertId })
    .execute();

  if (updateResult.affected === 0) throw conflict("No tickets available");

  // SIMULATE FAILURE FOR ROLLBACK PROOF
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

  return {
    reservationId: reservation.id,
    ticketId: ticket.id,
    expiresAt: reservation.expiresAt,
  };
}

export class ReservationService {
  constructor(private datasource: DataSource = AppDataSource) {}

  // ─── Original ─────────────────────────────────────────────────────────────

  async reserve(input: {
    concertId: string;
    userId: string;
    category: "VIP" | "General";
    simulateFailure?: boolean;
  }) {
    const queryRunner = this.datasource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      const result = await buildReservation(queryRunner, input);
      await queryRunner.commitTransaction();
      return result;
    } catch (error) {
      await queryRunner.rollbackTransaction();
      throw error;
    } finally {
      await queryRunner.release();
    }
  }

  // ─── Method A: Optimistic Locking ─────────────────────────────────────────
  // better-sqlite3 has ONE shared synchronous connection — two queryRunners
  // cannot open separate transactions concurrently (causes "cannot start a
  // transaction within a transaction").
  //
  // Solution: skip queryRunner entirely. Use the datasource manager directly.
  // Each operation auto-commits immediately. The race is detected at the
  // ticketRepo.save() step — TypeORM compares ticket.version against the DB
  // value and throws OptimisticLockVersionMismatchError if another request
  // already incremented it → mapped to 409 lock_conflict.

  async reserveOptimistic(input: {
    concertId: string;
    userId: string;
    category: "VIP" | "General";
  }) {
    const manager = this.datasource.manager;
    const concertRepo = manager.getRepository(Concert);
    const ticketRepo = manager.getRepository(Ticket);
    const reservationRepo = manager.getRepository(Reservation);

    try {
      // VALIDATE CONCERT AND STOCK
      const concert = await concertRepo.findOneBy({ id: input.concertId });
      if (!concert) throw notFound("Concert not found");
      if (concert.availableStock <= 0) throw conflict("No tickets available");

      // FIND AVAILABLE TICKET — version is read here
      const ticket = await ticketService.getAvailableTicket(
        manager,
        input.concertId,
        input.category,
      );
      if (!ticket) throw conflict("No available ticket for this category");

      // ATOMIC STOCK DECREMENT
      const updateResult = await concertRepo
        .createQueryBuilder()
        .update(Concert)
        .set({ availableStock: () => "available_stock - 1" })
        .where("id = :id AND available_stock > 0", { id: input.concertId })
        .execute();

      if (updateResult.affected === 0) throw conflict("No tickets available");

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

      // HOLD TICKET — TypeORM checks ticket.version against DB here.
      // If another request already incremented it, throws
      // OptimisticLockVersionMismatchError → 409 lock_conflict.
      ticket.status = "HELD";
      ticket.reservationId = reservation.id;
      await ticketRepo.save(ticket);

      return {
        reservationId: reservation.id,
        ticketId: ticket.id,
        expiresAt: reservation.expiresAt,
        method: "optimistic",
      };
    } catch (error) {
      if (error instanceof OptimisticLockVersionMismatchError) {
        throw lockConflict(
          "Ticket was modified by another request. Please try again.",
        );
      }
      throw error;
    }
  }

  // ─── Method B: Pessimistic Locking (SQLite: BEGIN IMMEDIATE) ──────────────
  // BEGIN IMMEDIATE acquires the write lock at transaction start.
  // Second concurrent request blocks at the SQLite level until the first
  // commits — it then sees the updated ticket status and gets conflict().
  // On PostgreSQL (post-migration), replace with pessimistic_write row lock.

  async reservePessimistic(input: {
    concertId: string;
    userId: string;
    category: "VIP" | "General";
  }) {
    const queryRunner = this.datasource.createQueryRunner();
    await queryRunner.connect();

    // BEGIN IMMEDIATE — acquires write lock immediately, not lazily
    await queryRunner.query("BEGIN IMMEDIATE");
    (queryRunner as any).isTransactionActive = true;

    try {
      const result = await buildReservation(queryRunner, input);
      await queryRunner.commitTransaction();
      return { ...result, method: "pessimistic" };
    } catch (error) {
      await queryRunner.rollbackTransaction();
      throw error;
    } finally {
      await queryRunner.release();
    }
  }

  // ─── Purchase ─────────────────────────────────────────────────────────────

  async purchase(reservationId: string) {
    const queryRunner = this.datasource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      const reservationRepo = queryRunner.manager.getRepository(Reservation);
      const ticketRepo = queryRunner.manager.getRepository(Ticket);

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

      reservation.status = "COMPLETED";
      await reservationRepo.save(reservation);

      const ticket = await ticketRepo.findOneBy({ id: reservation.ticketId });
      if (ticket) {
        ticket.status = "SOLD";
        await ticketRepo.save(ticket);
      }

      await queryRunner.commitTransaction();
      return { reservationId, status: "COMPLETED" };
    } catch (error) {
      await queryRunner.rollbackTransaction();
      throw error;
    } finally {
      await queryRunner.release();
    }
  }

  // ─── Cleanup ──────────────────────────────────────────────────────────────

  async cleanup(limit = 100) {
    const expired = await this.datasource
      .getRepository(Reservation)
      .createQueryBuilder("r")
      .where("r.status = 'PENDING' AND r.expires_at <= :now", {
        now: new Date(),
      })
      .take(limit)
      .getMany();

    if (expired.length === 0) return { expired: 0, released: 0 };

    const queryRunner = this.datasource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      const reservationRepo = queryRunner.manager.getRepository(Reservation);
      const ticketRepo = queryRunner.manager.getRepository(Ticket);
      const concertRepo = queryRunner.manager.getRepository(Concert);
      let released = 0;

      for (const r of expired) {
        const reservation = await reservationRepo.findOneBy({
          id: r.id,
          status: "PENDING",
        });
        if (!reservation) continue;

        reservation.status = "EXPIRED";
        await reservationRepo.save(reservation);

        const ticket = await ticketRepo.findOneBy({ id: reservation.ticketId });
        if (ticket && ticket.status === "HELD") {
          ticket.status = "AVAILABLE";
          ticket.reservationId = null;
          await ticketRepo.save(ticket);

          await concertRepo
            .createQueryBuilder()
            .update(Concert)
            .set({ availableStock: () => "available_stock + 1" })
            .where("id = :id", { id: reservation.concertId })
            .execute();

          released += 1;
        }
      }

      await queryRunner.commitTransaction();
      return { expired: expired.length, released };
    } catch (error) {
      await queryRunner.rollbackTransaction();
      throw error;
    } finally {
      await queryRunner.release();
    }
  }
}
