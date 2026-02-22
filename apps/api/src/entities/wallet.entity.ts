import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  OneToMany,
  PrimaryGeneratedColumn,
  Unique,
  UpdateDateColumn,
} from 'typeorm'
import type { WhaleScore } from './whale-score.entity'
import type { Transaction } from './transaction.entity'
import type { Alert } from './alert.entity'

export enum Chain {
  ETH = 'eth',
  SOL = 'sol',
  BNB = 'bnb',
  BASE = 'base',
  ARB = 'arb',
  TRON = 'tron',
  BTC = 'btc',
}

export enum WalletType {
  EARLY_ADOPTER = 'Early Adopter',
  DEFI_DEGEN = 'DeFi Degen',
  NFT_TRADER = 'NFT Trader',
  LONG_TERM_HOLDER = 'Long-term Holder',
  ARBITRAGEUR = 'Arbitrageur',
  // SPEC.md §11 + CLAUDE.md: NUNCA usar "Insider" isolado
  INFORMACAO_PRIVILEGIADA = 'Informação Privilegiada Possível',
}

export enum WalletStatus {
  ACTIVE = 'active',
  OBSERVACAO = 'observacao',
  DESQUALIFICADO = 'desqualificado',
}

@Entity('wallets')
@Unique('UQ_wallet_address_chain', ['address', 'chain'])
@Index('IDX_wallet_chain', ['chain'])
@Index('IDX_wallet_status', ['status'])
export class Wallet {
  @PrimaryGeneratedColumn('uuid')
  id!: string

  @Column({ type: 'varchar', length: 255 })
  address!: string

  @Column({ type: 'enum', enum: Chain, enumName: 'chain_enum' })
  chain!: Chain

  @Column({
    type: 'enum',
    enum: WalletType,
    enumName: 'wallet_type_enum',
    nullable: true,
  })
  type!: WalletType | null

  @Column({ type: 'decimal', precision: 20, scale: 8, nullable: true })
  currentScore!: string | null

  @Column({ type: 'decimal', precision: 10, scale: 6, nullable: true })
  winRate!: string | null

  @Column({ type: 'decimal', precision: 20, scale: 8, nullable: true })
  roi!: string | null

  @Column({ type: 'integer', default: 0 })
  totalOperations!: number

  @Column({ type: 'timestamp with time zone' })
  firstSeen!: Date

  @Column({ type: 'timestamp with time zone', nullable: true })
  lastActive!: Date | null

  @Column({
    type: 'enum',
    enum: WalletStatus,
    enumName: 'wallet_status_enum',
    default: WalletStatus.OBSERVACAO,
  })
  status!: WalletStatus

  @CreateDateColumn({ type: 'timestamp with time zone' })
  createdAt!: Date

  @UpdateDateColumn({ type: 'timestamp with time zone' })
  updatedAt!: Date

  @OneToMany('WhaleScore', 'wallet')
  scores!: WhaleScore[]

  @OneToMany('Transaction', 'wallet')
  transactions!: Transaction[]

  @OneToMany('Alert', 'wallet')
  alerts!: Alert[]
}
