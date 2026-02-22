'use client'

import { useCallback, useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase'
import type { User } from '@supabase/supabase-js'

const API = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001'

type Stats = { totalWallets: number; totalTransactions: number; totalAlerts: number }
type ApiWallet = {
  id: string
  address: string
  chain: string
  currentScore: string | null
  winRate: string | null
  status: string
  totalOperations: number
}
type ApiTransaction = {
  id: string
  wallet: { address: string } | null
  tokenSymbol: string | null
  tokenAddress: string
  chain: string
  type: 'buy' | 'sell'
  amountUsd: string
  timestamp: string
  createdAt: string
}

const NAV_ITEMS = [
  { icon: '▦', label: 'Dashboard', active: true },
  { icon: '🐋', label: 'Whales', soon: true },
  { icon: '◈', label: 'Tokens', soon: true },
  { icon: '◎', label: 'Alertas', soon: true },
  { icon: '◇', label: 'Portfólio', soon: true },
]

function abbrev(addr: string): string {
  if (addr.length <= 12) return addr
  return `${addr.slice(0, 6)}...${addr.slice(-4)}`
}

function fmtUSD(val: string): string {
  const n = parseFloat(val)
  if (isNaN(n)) return '—'
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', minimumFractionDigits: 0, maximumFractionDigits: 0 }).format(n)
}

function fmtScore(val: string | null): string {
  if (val === null || val === undefined) return '—'
  const n = parseFloat(val)
  if (isNaN(n)) return '—'
  return n.toFixed(1)
}

function fmtWinRate(val: string | null): string {
  if (val === null || val === undefined) return '—'
  const n = parseFloat(val)
  if (isNaN(n)) return '—'
  return `${(n * 100).toFixed(1)}%`
}

function timeAgo(ts: string): string {
  const diff = Date.now() - new Date(ts).getTime()
  const s = Math.floor(diff / 1000)
  if (s < 60) return `${s}s atrás`
  const m = Math.floor(s / 60)
  if (m < 60) return `${m}min atrás`
  const h = Math.floor(m / 60)
  if (h < 24) return `${h}h atrás`
  const d = Math.floor(h / 24)
  return `${d}d atrás`
}

function scoreColor(score: string | null): string {
  if (!score) return '#64748b'
  const n = parseFloat(score)
  if (n >= 75) return '#34d399'
  if (n >= 50) return '#22d3ee'
  if (n >= 25) return '#818cf8'
  return '#f87171'
}

function SkeletonRows({ cols, rows = 5 }: { cols: number; rows?: number }): React.ReactElement {
  return (
    <>
      {Array.from({ length: rows }).map((_, i) => (
        <tr key={i}>
          {Array.from({ length: cols }).map((_, j) => (
            <td key={j}>
              <div className="dash-skeleton" style={{ height: 16, width: j === 0 ? 120 : j === cols - 1 ? 60 : 80 }} />
            </td>
          ))}
        </tr>
      ))}
    </>
  )
}

function SkeletonCards({ count = 4 }: { count?: number }): React.ReactElement {
  return (
    <>
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className="dash-whale-card">
          <div className="dash-skeleton" style={{ height: 20, width: '60%', marginBottom: 12 }} />
          <div className="dash-skeleton" style={{ height: 32, width: '40%', marginBottom: 8 }} />
          <div className="dash-skeleton" style={{ height: 4, marginBottom: 12 }} />
          <div className="dash-skeleton" style={{ height: 14, width: '80%' }} />
        </div>
      ))}
    </>
  )
}

export default function DashboardPage(): React.ReactElement {
  const router = useRouter()
  const [user, setUser] = useState<User | null>(null)

  const [stats, setStats] = useState<Stats | null>(null)
  const [loadingStats, setLoadingStats] = useState(true)

  const [transactions, setTransactions] = useState<ApiTransaction[]>([])
  const [loadingTx, setLoadingTx] = useState(true)

  const [wallets, setWallets] = useState<ApiWallet[]>([])
  const [loadingWallets, setLoadingWallets] = useState(true)

  useEffect(() => {
    const supabase = createClient()
    supabase.auth.getUser().then(({ data }) => {
      setUser(data.user)
    })
  }, [])

  const fetchAll = useCallback(async () => {
    const [statsRes, txRes, walletsRes] = await Promise.allSettled([
      fetch(`${API}/stats`).then(r => r.json() as Promise<Stats>),
      fetch(`${API}/transactions?limit=20`).then(r => r.json() as Promise<ApiTransaction[]>),
      fetch(`${API}/wallets?limit=10`).then(r => r.json() as Promise<ApiWallet[]>),
    ])

    if (statsRes.status === 'fulfilled') setStats(statsRes.value)
    setLoadingStats(false)

    if (txRes.status === 'fulfilled' && Array.isArray(txRes.value)) setTransactions(txRes.value)
    setLoadingTx(false)

    if (walletsRes.status === 'fulfilled' && Array.isArray(walletsRes.value)) setWallets(walletsRes.value)
    setLoadingWallets(false)
  }, [])

  useEffect(() => {
    fetchAll()
    const id = setInterval(fetchAll, 30_000)
    return () => clearInterval(id)
  }, [fetchAll])

  async function handleLogout() {
    const supabase = createClient()
    await supabase.auth.signOut()
    router.push('/login')
  }

  return (
    <div className="dash-layout">
      {/* ── SIDEBAR ── */}
      <aside className="dash-sidebar">
        <div className="dash-sidebar-logo">
          <div className="dash-sidebar-logo-icon">🐋</div>
          SmartWhale
        </div>

        <nav className="dash-nav">
          <span className="dash-nav-section">Menu</span>
          {NAV_ITEMS.map((item) => (
            <button
              key={item.label}
              className={`dash-nav-item${item.active ? ' active' : ''}`}
              disabled={item.soon}
              style={item.soon ? { cursor: 'default', opacity: 0.5 } : undefined}
            >
              <span className="dash-nav-icon">{item.icon}</span>
              <span className="dash-nav-label">{item.label}</span>
              {item.soon && <span className="dash-nav-badge">em breve</span>}
            </button>
          ))}

          <span className="dash-nav-section" style={{ marginTop: 'auto' }}>
            Conta
          </span>
          <button className="dash-nav-item">
            <span className="dash-nav-icon">⚙</span>
            <span className="dash-nav-label">Configurações</span>
          </button>
        </nav>

        <div className="dash-sidebar-footer">
          <button className="dash-logout" onClick={handleLogout}>
            <span>↩</span>
            <span>Sair</span>
          </button>
        </div>
      </aside>

      {/* ── MAIN ── */}
      <div className="dash-main">
        {/* Topbar */}
        <header className="dash-topbar">
          <span className="dash-topbar-title">Dashboard</span>
          <div className="dash-topbar-right">
            <span className="dash-plan-badge">FREE</span>
            {user && (
              <span className="dash-user-email">
                {user.email}
              </span>
            )}
          </div>
        </header>

        {/* Content */}
        <main className="dash-content">

          {/* ── STATS CARDS ── */}
          <div className="dash-stats-grid">
            <div className="dash-stat-card">
              <span className="dash-stat-icon">🐋</span>
              <span className="dash-stat-value">
                {loadingStats ? <span className="dash-skeleton" style={{ display: 'inline-block', width: 60, height: 32 }} /> : (stats?.totalWallets ?? 0).toLocaleString()}
              </span>
              <span className="dash-stat-label">Wallets monitoradas</span>
            </div>
            <div className="dash-stat-card">
              <span className="dash-stat-icon">⚡</span>
              <span className="dash-stat-value">
                {loadingStats ? <span className="dash-skeleton" style={{ display: 'inline-block', width: 60, height: 32 }} /> : (stats?.totalTransactions ?? 0).toLocaleString()}
              </span>
              <span className="dash-stat-label">Transações indexadas</span>
            </div>
            <div className="dash-stat-card">
              <span className="dash-stat-icon">◎</span>
              <span className="dash-stat-value">
                {loadingStats ? <span className="dash-skeleton" style={{ display: 'inline-block', width: 60, height: 32 }} /> : (stats?.totalAlerts ?? 0).toLocaleString()}
              </span>
              <span className="dash-stat-label">Alertas gerados</span>
            </div>
          </div>

          {/* ── FEED DE TRANSAÇÕES ── */}
          <section className="dash-section">
            <h3 className="dash-section-title">Feed de Transações Recentes</h3>
            <div className="dash-table-wrap">
              <table className="dash-feed-table">
                <thead>
                  <tr>
                    <th>Wallet</th>
                    <th>Token</th>
                    <th>Tipo</th>
                    <th>Valor</th>
                    <th>Chain</th>
                    <th>Tempo</th>
                  </tr>
                </thead>
                <tbody>
                  {loadingTx && <SkeletonRows cols={6} rows={5} />}
                  {!loadingTx && transactions.map((tx) => (
                    <tr key={tx.id}>
                      <td>
                        <span className="dash-feed-wallet">
                          {tx.wallet ? abbrev(tx.wallet.address) : '—'}
                        </span>
                      </td>
                      <td>
                        <span className="dash-feed-token">
                          {tx.tokenSymbol ?? abbrev(tx.tokenAddress)}
                        </span>
                      </td>
                      <td>
                        <span className={`dash-feed-tag dash-feed-tag-${tx.type}`}>
                          {tx.type.toUpperCase()}
                        </span>
                      </td>
                      <td>
                        <span className="dash-feed-amount">{fmtUSD(tx.amountUsd)}</span>
                      </td>
                      <td>
                        <span className="dash-feed-chain">{tx.chain}</span>
                      </td>
                      <td>
                        <span className="dash-feed-time">{timeAgo(tx.timestamp)}</span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {!loadingTx && transactions.length === 0 && (
                <p className="dash-section-empty">Nenhuma transação indexada ainda.</p>
              )}
            </div>
          </section>

          {/* ── RANKING DE WHALES ── */}
          <section className="dash-section">
            <h3 className="dash-section-title">Ranking de Whales</h3>
            <div className="dash-whale-grid">
              {loadingWallets && <SkeletonCards count={4} />}
              {!loadingWallets && wallets.map((w) => {
                const score = w.currentScore ? parseFloat(w.currentScore) : null
                const color = scoreColor(w.currentScore)
                return (
                  <div key={w.id} className="dash-whale-card">
                    <div className="dash-whale-header">
                      <span className="dash-whale-addr">{abbrev(w.address)}</span>
                      <span className="dash-whale-chain">{w.chain}</span>
                    </div>
                    <div className="dash-whale-score-row">
                      <span className="dash-whale-score-val" style={{ color }}>
                        {fmtScore(w.currentScore)}
                      </span>
                      <div className="dash-whale-score-bar-wrap">
                        <div
                          className="dash-whale-score-bar"
                          style={{
                            width: score !== null ? `${Math.min(score, 100)}%` : '0%',
                            background: color,
                          }}
                        />
                      </div>
                    </div>
                    <div className="dash-whale-meta">
                      <span>WR: {fmtWinRate(w.winRate)}</span>
                      <span>{w.totalOperations} ops</span>
                      <span>{w.status}</span>
                    </div>
                  </div>
                )
              })}
            </div>
            {!loadingWallets && wallets.length === 0 && (
              <p className="dash-section-empty">Nenhuma whale monitorada ainda.</p>
            )}
          </section>

        </main>
      </div>
    </div>
  )
}
