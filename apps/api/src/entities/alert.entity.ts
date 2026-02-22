import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm'
import { Wallet } from './wallet.entity'

export enum AlertType {
  WHALE_MOVEMENT = 'whale_movement',
  CONFLUENCE = 'confluence',
  ACCUMULATION = 'accumulation',
  // SPEC.md §5.3: alerta de cancelamento explícito em caso de reorg — NUNCA silenciar
  REORG_CANCEL = 'reorg_cancel',
}

@Entity('alerts')
@Index('IDX_alert_wallet_id', ['wallet'])
@Index('IDX_alert_type', ['type'])
@Index('IDX_alert_is_read', ['isRead'])
@Index('IDX_alert_created_at', ['createdAt'])
export class Alert {
  @PrimaryGeneratedColumn('uuid')
  id!: string

  @ManyToOne(() => Wallet, (wallet) => wallet.alerts, {
    nullable: false,
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'wallet_id' })
  wallet!: Wallet

  @Column({ type: 'enum', enum: AlertType, enumName: 'alert_type_enum' })
  type!: AlertType

  @Column({ type: 'text' })
  message!: string

  // Valor monetário associado ao alerta (ex: montante da transação em USD)
  @Column({ type: 'decimal', precision: 20, scale: 8, nullable: true })
  value!: string | null

  @Column({ type: 'boolean', default: false })
  isRead!: boolean

  @CreateDateColumn({ type: 'timestamp with time zone' })
  createdAt!: Date
}
