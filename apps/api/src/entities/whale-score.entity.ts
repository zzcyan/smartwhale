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

@Entity('whale_scores')
@Index('IDX_whale_score_wallet_id', ['wallet'])
@Index('IDX_whale_score_calculated_at', ['calculatedAt'])
export class WhaleScore {
  @PrimaryGeneratedColumn('uuid')
  id!: string

  @ManyToOne(() => Wallet, (wallet) => wallet.scores, {
    nullable: false,
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'wallet_id' })
  wallet!: Wallet

  // Score all-time com decay exponencial — SPEC.md §2.3
  @Column({ type: 'decimal', precision: 20, scale: 8 })
  scoreAllTime!: string

  // Janela deslizante 90 dias sem decay — SPEC.md §2.3
  @Column({ type: 'decimal', precision: 20, scale: 8 })
  score90d!: string

  @Column({ type: 'decimal', precision: 10, scale: 6 })
  winRate!: string

  // Sharpe ratio on-chain — SPEC.md §2.1 (25% do score)
  @Column({ type: 'decimal', precision: 20, scale: 8 })
  sharpeRatio!: string

  // ROI ajustado pelo Token Risk Score — SPEC.md §2.1 + §3
  @Column({ type: 'decimal', precision: 20, scale: 8 })
  roiAdjusted!: string

  @Column({ type: 'integer' })
  totalOperations!: number

  // Quando o algoritmo de score rodou (≠ createdAt que é o insert no banco)
  @Column({ type: 'timestamp with time zone' })
  calculatedAt!: Date

  @CreateDateColumn({ type: 'timestamp with time zone' })
  createdAt!: Date
}
