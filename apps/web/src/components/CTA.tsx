'use client'

import { useState } from 'react'

export default function CTA(): React.ReactElement {
  const [email, setEmail] = useState('')

  return (
    <section className="cta-section">
      <div className="cta-glow"></div>
      <div className="cta-inner">
        <h2>Stop guessing.<br />Start following.</h2>
        <p>Join 12,000+ traders already tracking smart money on-chain.</p>
        <div className="cta-form">
          <input
            className="cta-input"
            type="email"
            placeholder="your@email.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
          <button
            className="btn-hero"
            style={{ whiteSpace: 'nowrap', fontSize: '0.9rem', padding: '12px 22px' }}
          >
            Get early access
          </button>
        </div>
        <p
          style={{
            fontSize: '0.75rem',
            color: 'var(--muted)',
            marginTop: '1rem',
            fontFamily: "'DM Mono', monospace",
          }}
        >
          Free forever plan. No credit card required.
        </p>
      </div>
    </section>
  )
}
