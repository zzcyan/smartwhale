'use client'

import { useState } from 'react'
import { whaleData } from '@/data'

const pills = ['Win Rate', 'ROI / Trade', 'Sharpe Ratio', 'Hold Duration', 'Entry Timing', 'Drawdown Control']

export default function WhaleScore(): React.ReactElement {
  const [active, setActive] = useState('Win Rate')

  return (
    <section className="score-section" id="score">
      <div className="score-content">
        <div className="section-label">Whale Score™</div>
        <h2>
          Rank wallets by<br />
          <span style={{ color: 'var(--accent)' }}>actual intelligence.</span>
        </h2>
        <p>
          Forget wallets with $500M that make 6% a year. SmartWhale ranks who consistently beats
          the market with precision entries, staged exits, and insane win rates — regardless of
          capital size.
        </p>
        <div className="score-pills">
          {pills.map((p) => (
            <span
              key={p}
              className={`pill${active === p ? ' active' : ''}`}
              onClick={() => setActive(p)}
            >
              {p}
            </span>
          ))}
        </div>
      </div>

      <div className="score-panel">
        <div
          style={{
            fontFamily: "'DM Mono', monospace",
            fontSize: '0.7rem',
            color: 'var(--muted)',
            paddingBottom: '12px',
            borderBottom: '1px solid var(--border)',
            marginBottom: '4px',
          }}
        >
          TOP SMART MONEY — ALL CHAINS — 90D
        </div>
        {whaleData.map((w, i) => (
          <div key={w.addr} className="whale-row">
            <div className="whale-rank">{i + 1}</div>
            <div className="whale-avatar" style={{ background: 'rgba(34,211,238,0.1)' }}>
              {w.emoji}
            </div>
            <div className="whale-info">
              <div className="whale-addr">{w.addr}</div>
              <div className="whale-type">{w.type}</div>
            </div>
            <div>
              <div className="whale-pnl">{w.pnl}</div>
              <div className="whale-wr">{w.wr}</div>
            </div>
            <div className="whale-score-num">{w.score}</div>
          </div>
        ))}
      </div>
    </section>
  )
}
