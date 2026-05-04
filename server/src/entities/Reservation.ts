import { Column, CreateDateColumn, Entity, PrimaryColumn } from "typeorm";

@Entity("reservation")
export class Reservation {
  @PrimaryColumn()
  id!: string;

  @Column({ name: "concert_id" })
  concertId!: string;

  @Column({ name: "ticket_id" })
  ticketId!: string;

  @Column({ name: "user_id" })
  userId!: string;

  @Column()
  status!: "PENDING" | "COMPLETED" | "EXPIRED";

  @Column({ name: "expires_at" })
  expiresAt!: Date;

  @CreateDateColumn({ name: "created_at" })
  createdAt!: Date;
}
