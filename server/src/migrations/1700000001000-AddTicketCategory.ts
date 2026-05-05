import { MigrationInterface, QueryRunner } from "typeorm";

export class AddTicketCategory1700000001000 implements MigrationInterface {
  name = "AddTicketCategory1700000001000";

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
        ALTER TABLE tickets ADD COLUMN category TEXT NOT NULL DEFAULT 'General'    
    `);

    // Composite index: covers the reserve query (concert + category + status)
    await queryRunner.query(`
        CREATE INDEX idx_tickets_concert_category_status ON tickets (concert_id, category, status)    
    `);
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      "DROP INDEX IF EXISTS idx_tickets_concert_category_status",
    );
    // SQLite doesn't support DROP COLUMN — would need table recreation
  }
}
