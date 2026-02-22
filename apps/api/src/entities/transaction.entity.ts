import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm'
import { Chain, Wallet } from './wallet.entity'

export enum TransactionType {
  BUY = 'buy',
  SELL = 'sell',
}

export enum TransactionStatus {
  // Dado ao vivo ainda não finalizado — exibido com label "Pendente" no feed
  PENDENTE = 'pendente',
  // Somente transações finalizadas entram no cálculo do score — SPEC.md §5
  FINALIZADO = 'finalizado',
}

@Entity('transactions')
@Index('IDX_tx_wallet_id', ['wallet'])
@Index('IDX_tx_chain', ['chain'])
@Index('IDX_tx_status', ['status'])
@Index('IDX_tx_timestamp', ['timestamp'])
@Index('IDX_tx_token_address', ['tokenAddress'])
// Index composto: otimiza a query do scoring pipeline (wallet + status + ordem temporal)
@Index('IDX_tx_wallet_status_ts', ['wallet', 'status', 'timestamp'])
export class Transaction {
  @PrimaryGeneratedColumn('uuid')
  id!: string

  @ManyToOne(() => Wallet, (wallet) => wallet.transactions, {
    nullable: false,
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'wallet_id' })
  wallet!: Wallet

  @Column({ type: 'varchar', length: 255 })
  tokenAddress!: string

  @Column({ type: 'varchar', length: 50, nullable: true })
  tokenSymbol!: string | null

  // Reutiliza o mesmo Postgres ENUM type criado para wallets.chain
  @Column({ type: 'enum', enum: Chain, enumName: 'chain_enum' })
  chain!: Chain

  @Column({ type: 'enum', enum: TransactionType, enumName: 'transaction_type_enum' })
  type!: TransactionType

  @Column({ type: 'decimal', precision: 20, scale: 8 })
  amountUsd!: string

  @Column({ type: 'varchar', length: 255, unique: true })
  txHash!: string

  // bigint no Postgres — TypeORM retorna como string no JavaScript
  @Column({ type: 'bigint' })
  blockNumber!: string

  // Horário on-chain da transação (≠ createdAt que é quando foi registrada no sistema)
  @Column({ type: 'timestamp with time zone' })
  timestamp!: Date

  @Column({
    type: 'enum',
    enum: TransactionStatus,
    enumName: 'transaction_status_enum',
    default: TransactionStatus.PENDENTE,
  })
  status!: TransactionStatus

  // Cache do Token Risk Score no momento da transação — SPEC.md §3
  @Column({ type: 'decimal', precision: 10, scale: 6, nullable: true })
  tokenRiskScore!: string | null

  // ROI ajustado — só populado para sells finalizados
  @Column({ type: 'decimal', precision: 20, scale: 8, nullable: true })
  roiAdjusted!: string | null

  // CAMPO CRÍTICO — SPEC.md §5 + CLAUDE.md
  // O pipeline de scoring DEVE verificar este campo: só processa quando isFinalized = true
  // Nunca calcular score com dados não-finalizados
  @Column({ type: 'boolean', default: false })
  isFinalized!: boolean

  @CreateDateColumn({ type: 'timestamp with time zone' })
  createdAt!: Date
}
