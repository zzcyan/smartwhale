import 'dotenv/config'
import { DataSource } from 'typeorm'
import { Wallet } from '../entities/wallet.entity'
import { WhaleScore } from '../entities/whale-score.entity'
import { Transaction } from '../entities/transaction.entity'
import { Alert } from '../entities/alert.entity'

const databaseUrl = process.env['DATABASE_URL']

if (!databaseUrl) {
  throw new Error(
    'DATABASE_URL não está configurado. ' +
      'Crie apps/api/.env com DATABASE_URL=postgresql://...',
  )
}

export const AppDataSource = new DataSource({
  type: 'postgres',
  url: databaseUrl,
  ssl: { rejectUnauthorized: false },
  entities: [Wallet, WhaleScore, Transaction, Alert],
  migrations: ['src/migrations/*.ts'],
  migrationsTableName: 'typeorm_migrations',
  synchronize: false,
  logging: ['migration'],
})
