import { MigrationInterface, QueryRunner } from "typeorm";

export class AddTicketVersion1700000002000 implements MigrationInterface {
  name = "AddTicketVersion1700000002000";

  async up(queryRunner: QueryRunner): Promise<void> {
    // version starts at 1 for all existing rows
    await queryRunner.query(`
      ALTER TABLE tickets ADD COLUMN version INTEGER NOT NULL DEFAULT 1
    `);
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    // SQLite does not support DROP COLUMN — full table recreation required
    await queryRunner.query(`
      CREATE TABLE tickets_backup AS SELECT
        id, concert_id, category, status, reservation_id, created_at
      FROM tickets
    `);
    await queryRunner.query(`DROP TABLE tickets`);
    await queryRunner.query(`
      CREATE TABLE tickets (
        id TEXT PRIMARY KEY NOT NULL,
        concert_id TEXT NOT NULL,
        category TEXT NOT NULL DEFAULT 'General',
        status TEXT NOT NULL CHECK (status IN ('AVAILABLE', 'HELD', 'SOLD')),
        reservation_id TEXT,
        created_at DATETIME NOT NULL DEFAULT (datetime('now')),
        FOREIGN KEY (concert_id) REFERENCES concerts(id)
      )
    `);
    await queryRunner.query(`
      INSERT INTO tickets SELECT * FROM tickets_backup
    `);
    await queryRunner.query(`DROP TABLE tickets_backup`);
  }
}
