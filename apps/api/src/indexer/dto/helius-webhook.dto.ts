import { IsArray } from 'class-validator'

/**
 * DTO do payload enviado pelo Helius enhanced webhook.
 *
 * O Helius envia um array de EnhancedTransaction no corpo da requisição.
 * A validação profunda de cada transação é feita pelo SolanaIndexer.parseTransaction()
 * — aqui apenas garantimos que recebemos um array.
 */
export class HeliusWebhookDto {
  @IsArray()
  transactions!: unknown[]
}
