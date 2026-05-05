import "reflect-metadata";
import { after, before, describe, test } from "node:test";
import assert from "node:assert/strict";
import path from "node:path";
import { rmSync } from "node:fs";
import { DataSource } from "typeorm";
import { Concert } from "../src/entities/Concert";
import { Ticket } from "../src/entities/Ticket";
import { Reservation } from "../src/entities/Reservation";
import { CreateSchema1700000000000 } from "../src/migrations/1700000000000-CreateSchema";
import { ReservationService } from "../src/services/ReservationService";
import { AddTicketCategory1700000001000 } from "../src/migrations/1700000001000-AddTicketCategory";

const testDbPath = path.resolve(`storage/test-${Date.now()}.sqlite`);

const TestDataSource = new DataSource({
  type: "better-sqlite3",
  database: testDbPath,
  synchronize: false,
  logging: false,
  entities: [Concert, Ticket, Reservation],
  migrations: [CreateSchema1700000000000, AddTicketCategory1700000001000],
});

const service = new ReservationService(TestDataSource);

// Reset to a clean state with `stock` available tickets before each test
async function reset(stock = 2) {
  await TestDataSource.getRepository(Reservation).clear();
  await TestDataSource.getRepository(Ticket).clear();
  await TestDataSource.getRepository(Concert).clear();

  await TestDataSource.getRepository(Concert).save({
    id: "concert-test",
    title: "Test Concert",
    venue: "Test Venue",
    startsAt: new Date(),
    totalStock: stock,
    availableStock: stock,
    createdAt: new Date(),
  });

  await TestDataSource.getRepository(Ticket).save(
    [
      {
        id: "1",
        concertId: "concert-test",
        category: "General" as const,
        status: "AVAILABLE" as const,
        reservationId: null,
        createdAt: new Date(),
      },
      {
        id: "2",
        concertId: "concert-test",
        category: "VIP" as const,
        status: "AVAILABLE" as const,
        reservationId: null,
        createdAt: new Date(),
      },
    ],
    { chunk: 2 },
  );
}

before(async () => {
  await TestDataSource.initialize();
  await TestDataSource.runMigrations();
});

after(async () => {
  await TestDataSource.destroy();
  rmSync(testDbPath, { force: true });
});

describe("reserve", () => {
  test("creates a PENDING reservation and decrements stock", async () => {
    await reset();
    const result = await service.reserve({
      concertId: "concert-test",
      userId: "user-1",
      category: "General",
    });

    assert.ok(result.reservationId);

    const concert = await TestDataSource.getRepository(Concert).findOneByOrFail(
      {
        id: "concert-test",
      },
    );
    assert.equal(concert.availableStock, 1);

    const reservation = await TestDataSource.getRepository(
      Reservation,
    ).findOneByOrFail({
      id: result.reservationId,
    });
    assert.equal(reservation.status, "PENDING");
  });

  test("rolls stock back when failure occurs mid-transaction", async () => {
    await reset();

    await assert.rejects(
      () =>
        service.reserve({
          concertId: "concert-test",
          userId: "user-1",
          category: "General",
          simulateFailure: true,
        }),
      /Simulated failure/,
    );

    const concert = await TestDataSource.getRepository(Concert).findOneByOrFail(
      {
        id: "concert-test",
      },
    );
    const reservationCount =
      await TestDataSource.getRepository(Reservation).count();

    assert.equal(concert.availableStock, 2); // stock unchanged
    assert.equal(reservationCount, 0);
  });

  test("rejects when stock is 0", async () => {
    await reset(0);

    await assert.rejects(
      () =>
        service.reserve({
          concertId: "concert-test",
          userId: "user-1",
          category: "General",
        }),
      { message: "No tickets available" },
    );
  });

  test("cocurrent requests only succeed up to available stock", async () => {
    await reset(2);

    const results = await Promise.allSettled(
      Array.from({ length: 8 }, (_, i) =>
        service.reserve({
          concertId: "concert-test",
          userId: `user-${i}`,
          category: "General",
        }),
      ),
    );

    const succeeded = results.filter((r) => r.status === "fulfilled").length;
    const concert = await TestDataSource.getRepository(Concert).findOneByOrFail(
      {
        id: "concert-test",
      },
    );

    assert.ok(succeeded <= 2, `Expected at most 2 successes, got ${succeeded}`);
    assert.equal(concert.availableStock, 2 - succeeded);
  });
});

describe("purchase", () => {
  test("converts PENDING reservations to COMPLETED and marks ticket SOLD", async () => {
    await reset();

    const { reservationId } = await service.reserve({
      concertId: "concert-test",
      userId: "user-1",
      category: "General",
    });

    const result = await service.purchase(reservationId);
    assert.equal(result.status, "COMPLETED");

    const ticket = await TestDataSource.getRepository(Ticket).findOneBy({
      reservationId,
    });
    assert.equal(ticket?.status, "SOLD");
  });

  test("rejects if reservation is already completed", async () => {
    await reset();

    const { reservationId } = await service.reserve({
      concertId: "concert-test",
      userId: "user-1",
      category: "General",
    });

    await service.purchase(reservationId);

    await assert.rejects(() => service.purchase(reservationId), {
      message: "Already completed",
    });
  });
});

describe("cleanup", () => {
  test("expires old PENDING reservations and restores stock", async () => {
    await reset();

    const { reservationId } = await service.reserve({
      concertId: "concert-test",
      userId: "user-1",
      category: "General",
    });

    // Push expires_at into the past to simulate an expired hold
    await TestDataSource.getRepository(Reservation).update(
      { id: reservationId },
      { expiresAt: new Date(Date.now() - 60_000) },
    );

    const result = await service.cleanup();

    assert.equal(result.expired, 1);
    assert.equal(result.released, 1);

    const concert = await TestDataSource.getRepository(Concert).findOneByOrFail(
      {
        id: "concert-test",
      },
    );
    assert.equal(concert.availableStock, 2); // stock fully restored
  });
});

describe("index", () => {
  test("EXPLAIN QUERY PLAN uses the partial pending index for cleanup query", async () => {
    const rows: Array<{ detail: string }> = await TestDataSource.query(
      `EXPLAIN QUERY PLAN
       SELECT * FROM reservations
       WHERE status = 'PENDING' AND expires_at <= datetime('now')`,
    );
    const plan = JSON.stringify(rows);
    assert.match(plan, /idx_reservations_pending/);
  });
});
