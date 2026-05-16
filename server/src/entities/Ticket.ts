import {
  Column,
  CreateDateColumn,
  Entity,
  PrimaryColumn,
  VersionColumn,
} from "typeorm";

@Entity("tickets")
export class Ticket {
  @PrimaryColumn({ type: "text" })
  id!: string;

  @Column({ name: "concert_id", type: "text" })
  concertId!: string;

  @Column({ type: "text", default: "General" })
  category!: "VIP" | "General";

  @Column({ type: "text" })
  status!: "AVAILABLE" | "HELD" | "SOLD";

  @Column({ name: "reservation_id", type: "text", nullable: true })
  reservationId!: string | null;

  @CreateDateColumn({ name: "created_at" })
  createdAt!: Date;

  /**
   * Optimistic locking — TypeORM increments this on every save.
   * If two requests read version=1 and both try to save, the second
   * throws OptimisticLockVersionMismatchError → caught as 409 Conflict.
   *
   * Also intentionally excluded from TicketDTO (Part 2 serialization layer).
   */
  @VersionColumn({ type: "integer" })
  version!: number;
}
