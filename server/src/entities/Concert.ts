import { Entity, PrimaryColumn, Column, CreateDateColumn } from "typeorm";

@Entity("concerts")
export class Concert {
  @PrimaryColumn({ type: "text" })
  id!: string;

  @Column({ type: "text" })
  title!: string;

  @Column({ type: "text" })
  venue!: string;

  @Column({ name: "starts_at", type: "datetime" })
  startsAt!: Date;

  @Column({ name: "total_stock", type: "integer" })
  totalStock!: number;

  @Column({ name: "available_stock", type: "integer" })
  availableStock!: number;

  @CreateDateColumn({ name: "created_at" })
  createdAt!: Date;
}
