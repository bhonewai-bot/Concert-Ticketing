import "reflect-metadata";
import path from "node:path";
import { DataSource } from "typeorm";
import { Concert } from "../entities/Concert";
import { Ticket } from "../entities/Ticket";
import { Reservation } from "../entities/Reservation";

const dbPath = path.resolve(
  process.env.SQLITE_PATH ?? "storage/ticketing.sqlite",
);

export const AppDataSource = new DataSource({
  type: "better-sqlite3",
  database: dbPath,
  synchronize: false,
  logging: false,
  entities: [Concert, Ticket, Reservation],
  migrations: [],
});

export async function initialzeDataSource(): Promise<void> {
  if (!AppDataSource.isInitialized) {
    await AppDataSource.initialize();
    await AppDataSource.runMigrations();
  }
}
