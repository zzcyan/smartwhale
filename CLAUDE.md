# SmartWhale — CLAUDE.md

## WHY

SmartWhale ranqueia wallets crypto por **inteligência reproduzível**, não por capital ou sorte.
O diferencial é o **Whale Score™**: recompensa win rate, consistência e Sharpe on-chain — não apostas concentradas que acertaram uma vez.
Concorrentes mostram volume e saldo. SmartWhale mostra **quem de fato é inteligente e copiável**.

---

## WHAT

### Stack

| Camada | Tecnologia | Hospedagem |
|---|---|---|
| Backend | NestJS + TypeScript | Render |
| Frontend | Next.js + TypeScript | Vercel |
| Banco | PostgreSQL | Supabase (free tier) |
| Cache + Filas | Redis | Upstash (free tier, serverless) |
| Jobs | Bull Queue | — |
| Auth | Supabase Auth | — |
| Pagamentos | Stripe | — |
| Monorepo | Turborepo | — |

### Arquitetura

**Monolito NestJS** — sem Kafka, sem microserviços. Módulos separados por domínio.
Quebrar em serviços só se houver gargalo real em produção.

### Módulos principais (`apps/api/src/`)

```
chains/       # Pipelines separados por chain (eth, sol, bnb, base, arb, tron, btc)
scoring/      # Whale Score, Token Risk Score, dual score (all-time + 90d)
clustering/   # Detecção de wallets relacionadas (conservador: 3+ heurísticas)
alerts/       # Alertas com cancelamento explícito em caso de reorg
confluence/   # Confluence signals (expiram em 24h)
accumulation/ # Acumulação silenciosa (regras determinísticas)
users/        # Planos, billing Stripe, cotas
jobs/         # Bull Queue: backfill, recálculo de score, expiração de signals
```

### Decisões arquiteturais críticas

- **Two-layer de dados:** feed ao vivo usa dados não-finalizados (marcados "Pendente"); score e histórico só atualizam após finalidade (ETH: 12 blocos, SOL: vote transactions)
- **Reorg:** alerta de cancelamento explícito ao usuário — nunca silenciar
- **RPC fallback:** Alchemy free tier (EVM) e Helius free tier (Solana) como primários — sem nodes próprios no MVP. Circuit breaker por erro ou latência alta com fallback para RPC público. Pipelines separados por chain, sem abstraction layer.
- **SLA > custo:** se budget de provider estourar, alerta ao time — sem corte automático silencioso
- **Clustering conservador:** só agrupa com 3+ heurísticas convergindo. Falso negativo é aceitável; falso positivo destrói credibilidade.
- **Backfill:** 12 meses ao entrar no radar; genesis só para wallets marcadas manualmente como alta prioridade

### Whale Score™ (resumo da fórmula)

`Score = 30% win_rate + 25% sharpe + 25% roi_ajustado + 20% consistência`

- ROI é ajustado pelo **Token Risk Score** (penaliza meme coins, contratos novos, baixo TVL)
- **Dual score:** all-time (com decay exponencial + peso maior em bear market) + 90 dias
- Desqualificado do ranking principal: < 30 operações, win rate < 40%, < 3 meses de histórico
- `Ver SPEC.md §2 e §3 para fórmula completa e regras de desqualificação`

### Chains no MVP

Todas as 7: Ethereum, Solana, BNB Chain, Base, Arbitrum, Tron, Bitcoin.
Base e Arbitrum reusam pipeline EVM. Bitcoin: saldo + coin age apenas (ROI completo = fase 2).

### Pricing

- **Free:** Top 20 whales, delay 15min, 3 alertas/dia, 7 dias histórico, ETH+SOL
- **Pro ($49/mês):** ranking completo, 7 chains, real-time, Whale Score completo, confluence, 90 dias
- **Enterprise ($299/mês):** tudo + API REST/WebSocket, webhooks, Telegram bot, SLA 99,9%
- **Gatilho de conversão:** delay de 15 minutos no free

---

## HOW

### Comandos

```bash
# Desenvolvimento
pnpm install          # instalar dependências (monorepo)
pnpm dev              # rodar api + web em paralelo
pnpm dev --filter=api # só o backend
pnpm dev --filter=web # só o frontend

# Build
pnpm build

# Banco
pnpm db:migrate       # rodar migrations Prisma
pnpm db:studio        # abrir Prisma Studio

# Testes
pnpm test             # todos os testes
pnpm test --filter=api
```

### Variáveis de ambiente necessárias

```
DATABASE_URL                          # Supabase PostgreSQL connection string
REDIS_URL                             # Upstash Redis URL
SUPABASE_URL, SUPABASE_ANON_KEY, SUPABASE_SERVICE_ROLE_KEY
STRIPE_SECRET_KEY, STRIPE_WEBHOOK_SECRET
ALCHEMY_API_KEY                       # EVM chains (ETH, Base, Arbitrum, BNB, Tron)
HELIUS_API_KEY                        # Solana
```

### Convenções de código

- TypeScript estrito (`strict: true`) em todos os pacotes
- Módulos NestJS por domínio — nenhum módulo importa diretamente de outro sem interface
- Nomes de jobs Bull em `SCREAMING_SNAKE_CASE` (ex: `BACKFILL_WALLET_HISTORY`)
- Toda transação exibida no feed deve ter campo `is_finalized: boolean`
- Confluence signals sempre com `expires_at`; job de limpeza roda a cada hora

### O que NUNCA fazer

- Nunca calcular score com dados não-finalizados
- Nunca agrupar wallets com menos de 3 heurísticas convergindo
- Nunca rotular wallet como "Insider" — usar "Informação Privilegiada Possível" com aviso legal
- Nunca cortar tráfego de RPC silenciosamente por budget — alertar o time primeiro
- Nunca adicionar Kafka, microserviços ou ClickHouse sem degradação real comprovada em produção
- Nunca exibir confluence signal após 24h no feed (pode ficar no histórico)
- Nunca exibir acumulação silenciosa antes da 3ª compra detectada

---

## Workflow

- Sempre criar uma branch nova antes de qualquer feature (`git checkout -b feat/nome-da-feature`)
- Nunca trabalhar direto na main
- Uma feature por sessão do Claude Code — limpar contexto com `/clear` ao terminar
- Ao iniciar sessão nova, rodar `/init` para recarregar contexto do CLAUDE.md
- Commits pequenos e descritivos após cada mudança funcional
- Ao notar que Claude está indo na direção errada, usar `Esc` imediatamente e corrigir — não deixar acumular erros
- Frontend (Next.js) faz deploy automático na Vercel a cada push na main
- Backend (NestJS) faz deploy automático no Render a cada push na main
- Testar localmente antes de mergear na main — Render leva ~30s pra acordar após inatividade, não confundir com bug

---

### Onde encontrar informações detalhadas

| Tópico | Referência |
|---|---|
| Whale Score™ fórmula completa | `SPEC.md §2` |
| Token Risk Score critérios | `SPEC.md §3` |
| Clustering heurísticas | `SPEC.md §4` |
| Reorg e two-layer | `SPEC.md §5` |
| RPC fallback e circuit breaker | `SPEC.md §6` |
| Schema do banco de dados | `SPEC.md §8` e `packages/database/schema.prisma` |
| Backfill strategy | `SPEC.md §9` |
| Confluence signals detalhado | `SPEC.md §12` |
| Acumulação silenciosa regras | `SPEC.md §13` |
| Pricing completo (tabela) | `SPEC.md §15` |
| Roadmap de fases | `SPEC.md §19` |
