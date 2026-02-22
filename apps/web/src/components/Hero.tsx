export default function Hero(): React.ReactElement {
  return (
    <section className="hero">
      <div className="hero-glow"></div>
      <div className="hero-badge">
        <div className="badge-dot"></div>
        Live on 8 chains — 2,400+ smart money wallets tracked
      </div>
      <h1>
        Follow the <span className="accent2">Smart Money.</span><br />
        Not just the <span className="accent">Big Money.</span>
      </h1>
      <p className="hero-sub">
        SmartWhale ranks crypto wallets by ROI, win rate, and pattern consistency —{' '}
        not just capital. Copy the whales that actually win.
      </p>
      <div className="hero-actions">
        <button className="btn-hero">Start for free →</button>
        <button className="btn-hero-ghost">
          <span>▶</span> Watch demo
        </button>
      </div>
      <div className="hero-stats">
        <div className="hero-stat">
          <div className="val">2.4<span>K</span></div>
          <div className="lbl">Smart wallets</div>
        </div>
        <div className="stat-sep"></div>
        <div className="hero-stat">
          <div className="val">8</div>
          <div className="lbl">Chains indexed</div>
        </div>
        <div className="stat-sep"></div>
        <div className="hero-stat">
          <div className="val">&lt;4<span>s</span></div>
          <div className="lbl">Alert latency</div>
        </div>
        <div className="stat-sep"></div>
        <div className="hero-stat">
          <div className="val">$38<span>B</span></div>
          <div className="lbl">Vol tracked/mo</div>
        </div>
      </div>
    </section>
  )
}
