import { Column, CreateDateColumn, Entity, PrimaryColumn } from "typeorm";

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
}
