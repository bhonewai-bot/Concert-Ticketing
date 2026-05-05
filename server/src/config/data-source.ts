import "reflect-metadata";
import path from "node:path";
import { DataSource, QueryRunner } from "typeorm";
import { Concert } from "../entities/Concert";
import { Ticket } from "../entities/Ticket";
import { Reservation } from "../entities/Reservation";
import { CreateSchema1700000000000 } from "../migrations/1700000000000-CreateSchema";
import { AddTicketCategory1700000001000 } from "../migrations/1700000001000-AddTicketCategory";

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
  migrations: [CreateSchema1700000000000, AddTicketCategory1700000001000],
});

// CONNECT AND RUN PENDING MIGRATIONS
export async function initialzeDataSource(): Promise<void> {
  if (!AppDataSource.isInitialized) {
    await AppDataSource.initialize();
    await AppDataSource.runMigrations();
  }
}

// CREATE QUERY RUNNER WITH BEGIN IMMEDIATE
// TypeORM's internal flag is set so .save() won't try to open a nested transaction.
export async function createImmediateQueryRunner(
  dataSource: DataSource = AppDataSource,
): Promise<QueryRunner> {
  const queryRunner = dataSource.createQueryRunner();
  await queryRunner.connect();
  await queryRunner.query("BEGIN IMMEDIATE");
  (queryRunner as any).isTransactionActive = true;
  return queryRunner;
}
