import { Column, CreateDateColumn, Entity, PrimaryColumn } from "typeorm";

@Entity("reservations")
export class Reservation {
  @PrimaryColumn({ type: "text" })
  id!: string;

  @Column({ name: "concert_id", type: "text" })
  concertId!: string;

  @Column({ name: "ticket_id", type: "text" })
  ticketId!: string;

  @Column({ name: "user_id", type: "text" })
  userId!: string;

  @Column({ type: "text" })
  status!: "PENDING" | "COMPLETED" | "EXPIRED";

  @Column({ name: "expires_at", type: "datetime" })
  expiresAt!: Date;

  @CreateDateColumn({ name: "created_at" })
  createdAt!: Date;
}
