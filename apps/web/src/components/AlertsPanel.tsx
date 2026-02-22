'use client'

import { useState } from 'react'
import { alertsData } from '@/data'

const pills = ['Telegram Bot', 'Email', 'Webhooks', 'Push Notifications', 'Discord']

export default function AlertsPanel(): React.ReactElement {
  const [active, setActive] = useState('Telegram Bot')

  return (
    <section className="alerts-section">
      <div className="alerts-panel">
        <div className="alerts-header">
          <div className="alerts-title">🔔 YOUR ALERTS</div>
          <div className="live-badge">
            <div className="live-dot"></div> STREAMING
          </div>
        </div>
        {alertsData.map((a, i) => {
          const isConf = a.type === 'accumulate'
          return (
            <div
              key={i}
              className="alert-item"
              style={{ animationDelay: `${i * 0.08}s` }}
            >
              <div className={`alert-icon ${a.type}`}>
                <span style={{ fontSize: '1rem' }}>{a.icon}</span>
              </div>
              <div className="alert-body">
                <div className="alert-title">{a.title}</div>
                <div className="alert-meta">{a.meta}</div>
              </div>
              <div>
                <div
                  className={`alert-amount${isConf ? '' : ` ${a.type}`}`}
                  style={
                    isConf
                      ? { color: 'var(--accent)', fontSize: '0.68rem', letterSpacing: '.05em' }
                      : {}
                  }
                >
                  {a.amount}
                </div>
                <div className="alert-time">{a.time}</div>
              </div>
            </div>
          )
        })}
      </div>

      <div className="score-content">
        <div className="section-label">Instant Signals</div>
        <h2>
          Know before<br />
          <span style={{ color: 'var(--accent2)' }}>the crowd does.</span>
        </h2>
        <p>
          SmartWhale pushes alerts the moment a tracked wallet moves — not after block confirmation
          delay, not batched every hour. Sub-5-second delivery to Telegram, email, or your system
          via webhooks.
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
        <button
          className="btn-hero"
          style={{ fontSize: '0.9rem', padding: '12px 24px', marginTop: '1rem' }}
        >
          Set up your first alert →
        </button>
      </div>
    </section>
  )
}
