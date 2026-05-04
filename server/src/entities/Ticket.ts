import { Column, CreateDateColumn, Entity, PrimaryColumn } from "typeorm";

@Entity("tickets")
export class Ticket {
  @PrimaryColumn()
  id!: string;

  @Column({ name: "concert_id" })
  concertId!: string;

  @Column({ default: "General" })
  category!: "VIP" | "General";

  @Column()
  status!: "AVAILABLE" | "HELD" | "SOLD";

  @Column({ name: "reservation_id", nullable: true })
  reservationId!: string | null;

  @CreateDateColumn({ name: "created_at" })
  createdAt!: Date;
}
