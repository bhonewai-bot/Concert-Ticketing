import { MigrationInterface, QueryRunner } from "typeorm";

export class CreateSchema1700000000000 implements MigrationInterface {
  name = "CreateSchema1700000000000";

  async up(queryRunner: QueryRunner): Promise<any> {
    await queryRunner.query(`
        CREATE TABLE concerts (
            id TEXT PRIMARY KEY NOT NULL,
            title TEXT NOT NULL,
            venue TEXT NOT NULL,
            starts_at DATETIME NOT NULL,
            total_stock INTEGER NOT NULL,
            available_stock INTEGER NOT NULL,
            created_at DATETIME NOT NULL DEFAULT (datetime('now'))
        )
    `);

    await queryRunner.query(`
        CREATE TABLE tickets (
            id TEXT PRIMARY KEY NOT NULL,
            concert_id TEXT NOT NULL,
            status TEXT NOT NULL CHECK (status IN ('AVAILABLE', 'HELD', 'SOLD')),
            reservation_id TEXT,
            created_at DATETIME NOT NULL DEFAULT (datetime('now')),
            FOREIGN KEY (concert_id) REFERENCES concerts(id)
        )
    `);

    await queryRunner.query(`
        CREATE TABLE reservations (
            id TEXT PRIMARY KEY NOT NULL,
            concert_id TEXT NOT NULL,
            ticket_id TEXT NOT NULL,
            user_id TEXT NOT NULL,
            status TEXT NOT NULL CHECK (status IN ('PENDING', 'COMPLETED', 'EXPIRED')),
            expires_at DATETIME NOT NULL,
            created_at DATETIME NOT NULL DEFAULT (datetime('now')),
            FOREIGN KEY (concert_id) REFERENCES concerts(id),
            FOREIGN KEY (ticket_id) REFERENCES tickets(id)
        )
    `);

    // B-Tree index on concert_id - speeds up seat queries per concert
    await queryRunner.query(
      `CREATE INDEX idx_tickets_concert_id ON tickets(concert_id)`,
    );

    // Partial index on PENDING only - cleanup never touches COMPLETED/EXPIRED rows
    await queryRunner.query(`
        CREATE INDEX idx_reservations_pending ON reservations(expires_at) WHERE status = 'PENDING'`);
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query("DROP INDEX IF EXISTS idx_tickets_concert_id");
    await queryRunner.query("DROP INDEX IF EXISTS idx_reservations_pending");
    await queryRunner.query("DROP TABLE IF EXISTS reservations");
    await queryRunner.query("DROP TABLE IF EXISTS tickets");
    await queryRunner.query("DROP TABLE IF EXISTS concerts");
  }
}
