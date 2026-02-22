'use client'

import { useState, useEffect } from 'react'
import { tokens, wallets, scores, amounts } from '@/data'
import type { Token, Wallet } from '@/data'

interface FeedRow {
  w: Wallet
  t: Token
  isBuy: boolean
  score: number
  amount: string
  time: string
  id: string
}

function timeAgo(): string {
  const s = Math.floor(Math.random() * 55) + 1
  return s < 60 ? `${s}s ago` : `${Math.floor(s / 60)}m ago`
}

function makeRow(): FeedRow {
  // Index is bounded by array length — non-null assertion is safe
  const w = wallets[Math.floor(Math.random() * wallets.length)]!
  const t = tokens[Math.floor(Math.random() * tokens.length)]!
  const score = scores[Math.floor(Math.random() * scores.length)]!
  const amount = amounts[Math.floor(Math.random() * amounts.length)]!
  return { w, t, isBuy: Math.random() > 0.38, score, amount, time: timeAgo(), id: crypto.randomUUID() }
}

export default function FeedTable(): React.ReactElement {
  const [rows, setRows] = useState<FeedRow[]>([])
  const [newId, setNewId] = useState<string | null>(null)

  useEffect(() => {
    // Populate initial rows client-side only to avoid SSR/hydration mismatch
    setRows(Array.from({ length: 8 }, makeRow))

    const interval = setInterval(() => {
      const row = makeRow()
      setNewId(row.id)
      setRows((prev) => [row, ...prev].slice(0, 10))
    }, 2800)
    return () => clearInterval(interval)
  }, [])

  return (
    <section className="feed-section">
      <div className="section-label">Live Activity</div>
      <div className="feed-header">
        <h2>Smart Money in Motion</h2>
        <div className="live-badge">
          <div className="live-dot"></div> LIVE
        </div>
      </div>
      <table className="feed-table">
        <thead>
          <tr>
            <th>Wallet</th>
            <th>Token</th>
            <th>Action</th>
            <th>Amount</th>
            <th>Whale Score</th>
            <th>Time</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.id} className={row.id === newId ? 'new-row' : ''}>
              <td>
                <div className="wallet">{row.w.addr}</div>
                <div className="wallet-name">{row.w.name}</div>
              </td>
              <td>
                <div className="token-cell">
                  <div
                    className="token-icon"
                    style={{ background: row.t.color + '22' }}
                  >
                    {row.t.icon}
                  </div>
                  <div>
                    <div className="token-name">{row.t.name}</div>
                    <div className="token-chain">{row.t.chain}</div>
                  </div>
                </div>
              </td>
              <td>
                <span className={`tag ${row.isBuy ? 'tag-buy' : 'tag-sell'}`}>
                  {row.isBuy ? 'BUY' : 'SELL'}
                </span>
              </td>
              <td className={row.isBuy ? 'amount-buy' : 'amount-sell'}>{row.amount}</td>
              <td>
                <div className="score-bar-wrap">
                  <div className="score-bar">
                    <div className="score-bar-fill" style={{ width: `${row.score}%` }}></div>
                  </div>
                  <div className="score-val">{row.score}</div>
                </div>
              </td>
              <td className="time-cell">{row.time}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </section>
  )
}
