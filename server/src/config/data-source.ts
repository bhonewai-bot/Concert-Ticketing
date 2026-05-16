import "reflect-metadata";
import path from "node:path";
import { DataSource } from "typeorm";
import { Concert } from "../entities/Concert";
import { Ticket } from "../entities/Ticket";
import { Reservation } from "../entities/Reservation";
import { CreateSchema1700000000000 } from "../migrations/1700000000000-CreateSchema";
import { AddTicketCategory1700000001000 } from "../migrations/1700000001000-AddTicketCategory";
import { AddTicketVersion1700000002000 } from "../migrations/1700000002000-AddTicketVersion";

// RESOLVE DATABASE FILE PATH
const dbPath = path.resolve(
  process.env.SQLITE_PATH ?? "storage/ticketing.sqlite",
);

// INITIALIZE DATA SOURCE
export const AppDataSource = new DataSource({
  type: "better-sqlite3",
  database: dbPath,
  synchronize: false,
  logging: false,
  entities: [Concert, Ticket, Reservation],
  migrations: [
    CreateSchema1700000000000,
    AddTicketCategory1700000001000,
    AddTicketVersion1700000002000,
  ],
});

// CONNECT AND RUN PENDING MIGRATIONS
export async function initialzeDataSource(): Promise<void> {
  if (!AppDataSource.isInitialized) {
    await AppDataSource.initialize();
    await AppDataSource.runMigrations();
  }
}

// -----------------------------------------------------------------------------
// NOTE: createImmediateQueryRunner is intentionally kept here as dead code.
//
// It issues BEGIN IMMEDIATE instead of TypeORM's default BEGIN DEFERRED,
// which acquires the SQLite write lock at transaction start — the correct fix
// for the double-selling race condition under concurrent load.
//
// We are not using it currently because the assignment requires startTransaction().
// If this project moves to production or high concurrency is needed on SQLite,
// swap back to this function in ReservationService.
//
// Note: this is SQLite-specific. On PostgreSQL, startTransaction() is sufficient
// because PostgreSQL uses MVCC and does not have SQLite's deferred locking issue.
// -----------------------------------------------------------------------------

// import { QueryRunner } from "typeorm";
//
// export async function createImmediateQueryRunner(
//   dataSource: DataSource = AppDataSource,
// ): Promise<QueryRunner> {
//   const queryRunner = dataSource.createQueryRunner();
//   await queryRunner.connect();
//   await queryRunner.query("BEGIN IMMEDIATE");
//   (queryRunner as any).isTransactionActive = true;
//   return queryRunner;
// }
