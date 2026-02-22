interface Feature {
  icon: string
  title: string
  desc: string
  highlight?: boolean
}

const features: Feature[] = [
  {
    icon: '⚡',
    title: 'Whale Score™',
    desc: 'Composite score combining ROI, win rate, consistency, and capital efficiency. Filter the noise instantly.',
    highlight: true,
  },
  {
    icon: '🔔',
    title: 'Real-time Alerts',
    desc: 'Get notified in &lt;4 seconds via Telegram, email, or webhooks when a whale you follow moves.',
  },
  {
    icon: '🔗',
    title: 'Wallet Clustering',
    desc: 'Automatically detects multi-wallet strategies used by the same whale via funding pattern analysis.',
  },
  {
    icon: '🎯',
    title: 'Confluence Detection',
    desc: 'Alerts you when 3+ smart money wallets buy the same token in the same 4-hour window. High conviction signal.',
  },
  {
    icon: '📊',
    title: 'PnL Simulation',
    desc: '"If you had copied this whale\'s last 30 moves, you\'d be up +340%." See it before you follow it.',
  },
  {
    icon: '🧠',
    title: 'Pattern Recognition',
    desc: 'Detects silent accumulation, staged exits, and insider-like timing patterns from on-chain behavior.',
  },
]

export default function Features(): React.ReactElement {
  return (
    <section className="features-section" id="features">
      <div className="text-center section-header">
        <div className="section-label" style={{ justifyContent: 'center' }}>Why SmartWhale</div>
        <h2>
          Built different.{' '}
          <span style={{ color: 'var(--accent)' }}>Ranked different.</span>
        </h2>
        <p
          style={{
            color: 'var(--muted2)',
            fontSize: '0.9rem',
            marginTop: '.5rem',
            maxWidth: '500px',
            marginLeft: 'auto',
            marginRight: 'auto',
          }}
        >
          Other trackers show you who has the most. We show you who earns the most — consistently.
        </p>
      </div>
      <div className="features-grid">
        {features.map((f) => (
          <div key={f.title} className={`feat-card${f.highlight ? ' feat-highlight' : ''}`}>
            <span className="feat-icon">{f.icon}</span>
            <h3>{f.title}</h3>
            <p dangerouslySetInnerHTML={{ __html: f.desc }} />
          </div>
        ))}
      </div>
    </section>
  )
}
