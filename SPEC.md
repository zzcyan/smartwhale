# SmartWhale — Especificação Técnica Completa

## 1. Visão Geral e Diferencial

SmartWhale é um SaaS de rastreamento de smart money crypto que ranqueia wallets por **inteligência reproduzível**, não por capital. O diferencial central é o **Whale Score™**: um score composto que recompensa consistência de processo (win rate, Sharpe, estabilidade de padrões) sobre resultados isolados. Um apostador concentrado que acertou 3 vezes grandes é ruído estatístico. Uma whale com 180 operações, 71% de win rate e Sharpe 2.1 é ensinável, copiável e confiável.

Concorrentes (Nansen, Arkham, DeBank) mostram volume e saldo. SmartWhale mostra **quem de fato é inteligente**.

---

## 2. Whale Score™

### 2.1 Fórmula Composta

| Métrica | Peso |
|---|---|
| Win rate | 30% |
| Sharpe ratio on-chain | 25% |
| ROI ajustado pelo Token Risk Score | 25% |
| Consistência de padrões (estabilidade entre períodos) | 20% |

### 2.2 Regras de Desqualificação

- **< 30 operações relevantes:** wallet entra como "Em Observação" — sem score público, sem ranking.
- **Win rate < 40%:** removida do ranking principal e inserida na categoria separada **"High Risk / High Reward"**, independente do ROI.
- **< 3 meses de histórico ativo:** excluída do all-time; aparece apenas no ranking de novatas.

### 2.3 Sistema Dual de Score

Cada wallet possui **dois scores independentes**:

1. **All-time Score:** cobre todo o histórico disponível com **decay exponencial** — operações antigas pesam menos mas nunca desaparecem. Operações em **bear market** recebem peso maior que as de bull market (detectado via índice de dominância do BTC + drawdown do mercado total).
2. **Score 90 Dias:** janela deslizante, sem decay, reflete quem está afiado agora.

O dashboard exibe os dois separadamente. Filtros padrão usam o score de 90 dias.

O all-time score exibe o indicador de transparência: `"Score baseado em X meses de histórico"` — especialmente relevante para wallets com backfill incompleto.

---

## 3. Token Risk Score

Fator de penalidade calculado automaticamente para cada token **antes** de o ROI entrar no Whale Score.

### 3.1 Critérios

| Critério | Penalidade quando... |
|---|---|
| TVL do pool | Baixo |
| Market cap | Pequeno |
| Idade do contrato | Novo |
| Volume médio diário (30d) | Baixo |
| Número de holders | Poucos |
| Histórico de rugpull/exploit | Presente |

Tokens com múltiplos critérios negativos recebem penalidade alta. O fator é multiplicado sobre o ROI da operação antes de entrar no score composto.

**Exemplo:** +500% num meme coin de $50k TVL e 200 holders vale muito menos do que +100% num token com $100M TVL e 2 anos de histórico.

---

## 4. Detecção de Wallets Relacionadas (Clustering)

### 4.1 Estratégia: Conservadora

Só agrupa wallets quando **3 ou mais heurísticas convergem**. Preferível ter o mesmo dono em dois perfis separados a contaminar scores de donos diferentes.

### 4.2 Heurísticas

- Funding pela mesma source wallet
- Timing correlacionado de transações
- Uso dos mesmos contratos/protocolos em sequência
- Dust transactions de linkagem

### 4.3 Sistema Híbrido com Feedback Humano

O agrupamento é automático. Usuários podem reportar erros:
- `"Essas wallets não são da mesma pessoa"` (falso positivo)
- `"Essas duas wallets são minhas e deveriam estar juntas"` (falso negativo)

Reports entram em fila de revisão e alimentam o modelo para melhorar as heurísticas ao longo do tempo.

---

## 5. Reorganizações de Bloco

### 5.1 Two-Layer Architecture

| Camada | Dados | Uso |
|---|---|---|
| Live feed | Transações não-finalizadas | Exibição visual (marcadas "Pendente") |
| Score e histórico | Somente dados finalizados | Cálculo de score, armazenamento permanente |

### 5.2 Finalidade por Chain

| Chain | Critério de finalidade |
|---|---|
| Ethereum | 12 blocos confirmados |
| Solana | Finalidade via vote transactions |
| Base, Arbitrum, BNB, Tron | Herdam critério da chain base (EVM: ~12 blocos) |
| Bitcoin | 6 confirmações |

### 5.3 Tratamento de Alertas com Reorg

Se um alerta já foi disparado e a transação sofre reorg: **emite alerta de cancelamento explícito** ao usuário. Nunca silenciar — o usuário pode ter tomado decisão baseado no alerta falso.

---

## 6. Pipeline de Ingestão e Fallback de RPC

### 6.1 Estratégia de Roteamento

- **Primário:** free tier dos providers (Alchemy para EVM, Helius para Solana) — sem nodes próprios no MVP
- **Fallback automático:** segundo provider via circuit breaker ativado por erro explícito **ou** latência alta
- Pipelines **separados por chain** — sem abstraction layer unificado (menos acoplamento, mais fácil de debugar)

### 6.2 Providers por Chain

| Chain | Provider primário | Fallback |
|---|---|---|
| Ethereum, Base, Arbitrum, BNB, Tron | Alchemy (free tier) | Segundo endpoint Alchemy ou RPC público |
| Solana | Helius (free tier) | RPC público Solana |
| Bitcoin | Blockstream.info API | Mempool.space API |

### 6.3 Budget e Limites de Free Tier

Free tiers têm rate limits. Se o limite for atingido, o sistema emite alerta ao time — sem degradação silenciosa. Migrar para plano pago conforme o produto crescer.

---

## 7. Arquitetura

### 7.1 Decisão: Monolito

Nenhum Kafka, nenhum microserviço no MVP. Monolito NestJS com separação clara de módulos por domínio. Se escalar e houver gargalo real, quebra-se em serviços depois.

### 7.2 Job Scheduling

**Bull Queue + Redis** para:
- Backfill de histórico de wallets
- Recálculo periódico do Whale Score
- Disparo de alertas
- Expiração de confluence signals

### 7.3 Estrutura de Pastas (Monorepo Turborepo)

```
smartwhale/
├── apps/
│   ├── api/                  # NestJS backend
│   │   ├── src/
│   │   │   ├── chains/       # Módulos por chain (eth, sol, bnb, base, arb, tron, btc)
│   │   │   ├── scoring/      # Whale Score, Token Risk Score
│   │   │   ├── clustering/   # Detecção de wallets relacionadas
│   │   │   ├── alerts/       # Sistema de alertas e notificações
│   │   │   ├── confluence/   # Confluence signals
│   │   │   ├── accumulation/ # Detecção de acumulação silenciosa
│   │   │   ├── users/        # Gestão de usuários, planos, billing
│   │   │   ├── jobs/         # Bull Queue jobs
│   │   │   └── api/          # REST + WebSocket (Enterprise)
│   └── web/                  # Next.js frontend
│       ├── app/
│       │   ├── dashboard/
│       │   ├── whales/
│       │   ├── tokens/
│       │   └── portfolio/
├── packages/
│   ├── database/             # Prisma schema + migrations
│   ├── types/                # TypeScript types compartilhados
│   └── config/               # Configurações compartilhadas
├── turbo.json
└── package.json
```

---

## 8. Banco de Dados

### 8.1 Decisão: PostgreSQL Puro (MVP)

PostgreSQL particionado por **chain + data**. ClickHouse só avaliado se queries analíticas degradarem de verdade em produção.

### 8.2 Estratégia de Particionamento

- Tabela `transactions`: particionada por `(chain, created_at)` — partições mensais
- Tabela `wallet_scores`: particionada por `chain`
- Read replica quando queries do dashboard começarem a impactar writes

### 8.3 Entidades Principais

```sql
-- Wallets
wallets (id, address, chain, cluster_id, first_seen, last_active, score_alltime, score_90d, whale_types, status)

-- Transações (particionada)
transactions (id, wallet_id, chain, tx_hash, token_address, type, amount_usd, roi_adjusted, token_risk_score, is_finalized, block_number, timestamp)

-- Token Risk Score (cache)
token_risk_scores (token_address, chain, tvl, market_cap, contract_age_days, daily_volume_30d, holder_count, has_exploit_history, risk_factor, updated_at)

-- Confluence Signals
confluence_signals (id, token_address, chain, signal_level, whale_count, avg_whale_score, started_at, expires_at, time_window)

-- Accumulation Patterns
accumulation_patterns (id, wallet_id, token_address, chain, purchase_count, total_usd, status, first_purchase_at, last_purchase_at)

-- Alertas
alerts (id, user_id, wallet_id, type, payload, sent_at, channel)

-- Clustering Reports
clustering_reports (id, user_id, report_type, wallet_ids, status, reviewed_at)
```

---

## 9. Backfill de Histórico

| Situação | Ação |
|---|---|
| Wallet entra no radar | Backfill dos **últimos 12 meses** |
| Wallet marcada como alta prioridade (manual) | Backfill **desde o bloco genesis** |
| Score incompleto | Exibe `"Score baseado em X meses de histórico"` |

O all-time score começa incompleto e fica mais preciso com o tempo — comportamento esperado e comunicado explicitamente ao usuário.

---

## 10. Chains no MVP

| Chain | Suporte | Pipeline |
|---|---|---|
| Ethereum | Completo | Próprio |
| Solana | Completo | Próprio |
| BNB Chain | Completo | EVM |
| Base | Completo | EVM (reusa Ethereum) |
| Arbitrum | Completo | EVM (reusa Ethereum) |
| Tron | Completo | EVM |
| Bitcoin | Limitado: saldo + coin age, sem ROI completo (UTXO) | Próprio |

**Bitcoin fase 2:** score completo com modelagem UTXO — diferencial competitivo (nenhum concorrente faz isso corretamente).

---

## 11. Classificação de Tipos de Whale

Wallets podem ter **múltiplos tipos**. O tipo dominante é exibido no card; os secundários aparecem no perfil detalhado.

| Tipo | Critério |
|---|---|
| **Early Adopter** | Comprou token com < 14 dias de existência, pelo menos 3 vezes no histórico |
| **Narrativa Trader** | 60%+ das compras nos últimos 90 dias em tokens da mesma categoria (AI, RWA, L2, meme, DeFi) — detectado via metadata do token |
| **DeFi Degen** | Maioria das operações em DeFi (DEX, lending, yield), alta frequência, múltiplos protocolos |
| **NFT Flipper** | 40%+ do volume histórico em NFTs, tempo médio de hold < 7 dias |
| **Informação Privilegiada Possível** | Comprou o token nas 72h antes de anúncio relevante (listing, parceria, hack) pelo menos 3 vezes — **nunca chamar de "Insider"**, sempre exibir aviso legal |

---

## 12. Confluence Signals

### 12.1 Regras de Disparo

- **Janela padrão:** 4 horas (filtros no dashboard: 1h, 4h, 24h)
- **Mínimo:** 3 whales comprando o mesmo token
- **Cross-chain:** conta como confluência válida (mesmo token, chains diferentes)

### 12.2 Níveis de Confiança

| Condição | Nível |
|---|---|
| 3+ whales com Whale Score médio ≥ 90 | **Alta Confiança** |
| 5+ whales com Whale Score médio ~60 | **Moderado** |

O número bruto de wallets importa menos que a qualidade delas.

### 12.3 Ciclo de Vida

- Signal expira após **24 horas** e some do feed automaticamente
- Fica registrado no histórico para análise posterior

---

## 13. Detecção de Acumulação Silenciosa

Regras determinísticas (sem ML no MVP):

| Critério | Valor |
|---|---|
| Mesma wallet + mesmo token | Obrigatório |
| Mínimo de compras | 5 |
| Intervalo mínimo entre compras | 2 horas |
| Limite por compra individual | ≤ 3% do volume diário do token |
| Soma total mínima | $50k |
| Janela total | 7 dias |

**Exibição:** aparece como `"Possível Acumulação Silenciosa"` após a **3ª compra detectada**, com contador que atualiza em tempo real. Antes da 3ª compra = ruído, não exibido.

---

## 14. Sistema de Alertas

### 14.1 Canais

- Email
- Telegram bot
- Webhooks customizados (Enterprise)
- Push notifications

### 14.2 Filtros Disponíveis (Pro+)

- Token específico
- Valor mínimo em USD
- Chain
- Tipo de evento (compra, venda, acumulação silenciosa, confluência, saída de smart money)

### 14.3 SLA de Latência

- Feed ao vivo: < 5s após confirmação on-chain (dados não-finalizados, marcados "Pendente")
- Alertas: < 5s após finalidade da transação

---

## 15. Pricing

| Feature | Free | Pro ($49/mês) | Enterprise ($299/mês) |
|---|---|---|---|
| Ranking de whales | Top 20 | Completo | Completo |
| Chains | ETH + SOL | Todas as 7 + meme coins | Todas as 7 + meme coins |
| Feed | Delay de 15 min | Real-time < 5s | Real-time < 5s |
| Alertas | 3/dia, sem filtros | Ilimitados + filtros | Ilimitados + filtros |
| Histórico | 7 dias | 90 dias | Completo |
| Whale Score detalhado | Não | Sim (com breakdown) | Sim (com breakdown) |
| Confluence signals | Não | Sim | Sim |
| Copy-trading simulation | Não | Sim | Sim |
| API REST + WebSocket | Não | Não | Sim |
| Webhooks customizados | Não | Não | Sim |
| Telegram bot dedicado | Não | Não | Sim |
| SLA | - | - | 99,9% + suporte prioritário |

**Principal gatilho de conversão Free → Pro:** delay de 15 minutos. O usuário vê a movimentação mas tarde demais para agir.

---

## 16. API (Enterprise)

- REST + WebSocket
- Rate limiting por plano
- Documentação + sandbox
- Webhooks com payload configurável
- Autenticação via API key com escopo

---

## 17. Autenticação e Segurança

- **Auth:** Supabase Auth (OAuth + 2FA)
- **Pagamentos:** Stripe (billing, cotas por plano, webhooks de upgrade/downgrade)
- Dados criptografados em repouso
- Rate limiting em todas as rotas públicas
- Auditoria de acessos (especialmente para dados de wallets e alertas)
- LGPD: dados pessoais dos usuários da plataforma isolados e com política de retenção definida

---

## 18. Deploy e Infraestrutura

- **Frontend:** Next.js (TypeScript) → Vercel
- **Backend:** NestJS (TypeScript) → Render
- **Banco:** PostgreSQL → Supabase (free tier)
- **Cache + Filas:** Redis → Upstash (free tier, serverless)
- **Jobs:** Bull Queue
- **Auth:** Supabase Auth
- **Pagamentos:** Stripe
- **Monorepo:** Turborepo
- **CI/CD:** Vercel (frontend automático) + Render (backend via GitHub)
- **Custo fixo inicial:** zero — escalar para planos pagos conforme crescimento

---

## 19. Roadmap de Fases

### MVP (fase 1)
- Todas as 7 chains com suporte definido nesta spec
- Whale Score™ completo (dual score, decay, bear market weight)
- Token Risk Score
- Clustering conservador + feedback humano
- Confluence signals
- Acumulação silenciosa (regras determinísticas)
- Classificação de tipos de whale
- Sistema de alertas (email, Telegram, webhooks Enterprise)
- Dashboard (feed ao vivo, ranking, perfil de whale, análise de token)
- Pricing Free/Pro/Enterprise com Stripe

### Fase 2
- Bitcoin: score completo com modelagem UTXO
- ClickHouse para analytics se PostgreSQL degradar
- ML para clustering e detecção de acumulação
- Copy-trading simulation (já previsto no Pro, implementação detalhada a definir)
- API pública completa com sandbox
- Portfólio pessoal (usuário conecta wallet e compara com top whales)
