import { Entity, PrimaryColumn, Column, CreateDateColumn } from "typeorm";

@Entity("concerts")
export class Concert {
  @PrimaryColumn()
  id!: string;

  @Column()
  title!: string;

  @Column()
  venue!: string;

  @Column({ name: "starts_at" })
  startsAt!: Date;

  @Column({ name: "total_stock" })
  totalStock!: number;

  @Column({ name: "available_stock" })
  availableStock!: number;

  @CreateDateColumn({ name: "created_at" })
  createdAt!: Date;
}
