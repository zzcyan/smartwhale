/**
 * seed-helius-webhook.ts
 *
 * Registra um enhanced webhook no Helius monitorando Jupiter V6 e Raydium.
 * O webhook envia transações do tipo SWAP para o endpoint:
 *   POST <WEBHOOK_URL>/indexer/helius/webhook
 *
 * Como executar (com ngrok rodando na porta 3001):
 *   ngrok http 3001
 *   # Copie o URL gerado (ex: https://abc123.ngrok.io) e adicione ao .env:
 *   # WEBHOOK_URL=https://abc123.ngrok.io
 *
 *   pnpm --filter=api exec ts-node -r tsconfig-paths/register \
 *     src/indexer/scripts/seed-helius-webhook.ts
 *
 * Variáveis de ambiente necessárias (.env):
 *   HELIUS_API_KEY  — chave de API do Helius (dashboard.helius.dev)
 *   WEBHOOK_URL     — URL base do backend (ex: https://abc.ngrok.io)
 */

import 'dotenv/config'

// ─── Programas monitorados ────────────────────────────────────────────────────

/** Jupiter V6 Aggregator — o maior aggregator de swap na Solana. */
const JUPITER_V6 = 'JUP6LkbZbjS1jKKwapdHNy74zcZ3tLUZoi5QNyVTaV4'

/** Raydium AMM — um dos principais DEXes na Solana. */
const RAYDIUM_AMM = '675kPX9MHTjS2zt1qfr1NYHuzeLXfQM9H24wFSUt1Mp8'

/** URL base da API do Helius. */
const HELIUS_API_BASE = 'https://api.helius.xyz/v0'

// ─── Tipos locais para a API REST do Helius ───────────────────────────────────

interface HeliusWebhook {
  webhookID: string
  webhookURL: string
  transactionTypes: string[]
  accountAddresses: string[]
  webhookType: string
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

async function listWebhooks(apiKey: string): Promise<HeliusWebhook[]> {
  const res = await fetch(`${HELIUS_API_BASE}/webhooks?api-key=${apiKey}`)
  if (!res.ok) {
    throw new Error(`Helius getAll failed: ${res.status} ${await res.text()}`)
  }
  return res.json() as Promise<HeliusWebhook[]>
}

async function createWebhook(
  apiKey: string,
  params: {
    webhookURL: string
    transactionTypes: string[]
    accountAddresses: string[]
    webhookType: string
    txnStatus: string
  },
): Promise<HeliusWebhook> {
  const res = await fetch(`${HELIUS_API_BASE}/webhooks?api-key=${apiKey}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(params),
  })
  if (!res.ok) {
    throw new Error(`Helius create failed: ${res.status} ${await res.text()}`)
  }
  return res.json() as Promise<HeliusWebhook>
}

// ─── Main ─────────────────────────────────────────────────────────────────────

async function main(): Promise<void> {
  const apiKey = process.env.HELIUS_API_KEY
  const webhookBaseUrl = process.env.WEBHOOK_URL

  if (!apiKey) {
    console.error('❌ HELIUS_API_KEY não definida no .env')
    process.exit(1)
  }

  if (!webhookBaseUrl) {
    console.error('❌ WEBHOOK_URL não definida no .env')
    console.error('   Exemplo: WEBHOOK_URL=https://abc123.ngrok.io')
    process.exit(1)
  }

  const webhookURL = `${webhookBaseUrl}/indexer/helius/webhook`
  console.log(`📡 Registrando webhook no Helius...`)
  console.log(`   URL:      ${webhookURL}`)
  console.log(`   Accounts: Jupiter V6 + Raydium AMM`)
  console.log(`   Tipo:     SWAP (enhanced)`)

  // Verifica se já existe webhook com esse URL para evitar duplicatas
  const existing = await listWebhooks(apiKey)
  const duplicate = existing.find((wh) => wh.webhookURL === webhookURL)

  if (duplicate) {
    console.log(`\n⚠️  Webhook já existe com este URL (ID: ${duplicate.webhookID})`)
    console.log(`   Para recriar, delete pelo dashboard do Helius ou via API:`)
    console.log(
      `   DELETE ${HELIUS_API_BASE}/webhooks/${duplicate.webhookID}?api-key=<KEY>`,
    )
    process.exit(0)
  }

  const webhook = await createWebhook(apiKey, {
    webhookURL,
    transactionTypes: ['SWAP'],
    accountAddresses: [JUPITER_V6, RAYDIUM_AMM],
    webhookType: 'enhanced',
    txnStatus: 'success',
  })

  console.log(`\n✅ Webhook registrado com sucesso!`)
  console.log(`   ID:  ${webhook.webhookID}`)
  console.log(`   URL: ${webhook.webhookURL}`)
  console.log(`\n💡 Para gerenciar o webhook:`)
  console.log(`   Listar:  GET ${HELIUS_API_BASE}/webhooks?api-key=<KEY>`)
  console.log(`   Deletar: DELETE ${HELIUS_API_BASE}/webhooks/${webhook.webhookID}?api-key=<KEY>`)
}

main().catch((err: unknown) => {
  console.error('❌ Erro ao registrar webhook:', err)
  process.exit(1)
})
