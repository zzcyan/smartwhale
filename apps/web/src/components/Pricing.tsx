interface PlanFeature {
  text: string
  muted?: boolean
}

interface Plan {
  name: string
  price: string
  desc: string
  popular?: boolean
  features: PlanFeature[]
  btnClass: string
  btnLabel: string
}

const plans: Plan[] = [
  {
    name: 'Free',
    price: '$0',
    desc: 'For explorers getting started with on-chain analysis.',
    features: [
      { text: 'Top 50 whale leaderboard' },
      { text: '2 chains (ETH + SOL)' },
      { text: '5 wallet alerts' },
      { text: '15-min alert delay' },
      { text: 'Whale Score detail',  muted: true },
      { text: 'Confluence signals',  muted: true },
      { text: 'API access',          muted: true },
    ],
    btnClass: 'btn-plan-outline',
    btnLabel: 'Get started free',
  },
  {
    name: 'Pro',
    price: '$49',
    desc: 'For serious traders who follow smart money full-time.',
    popular: true,
    features: [
      { text: 'Full leaderboard (2,400+ wallets)' },
      { text: 'All 8 chains' },
      { text: '100 wallet alerts' },
      { text: 'Real-time alerts (<5s)' },
      { text: 'Full Whale Score breakdown' },
      { text: 'Confluence signals' },
      { text: 'API access', muted: true },
    ],
    btnClass: 'btn-plan-fill',
    btnLabel: 'Start Pro trial',
  },
  {
    name: 'Enterprise',
    price: '$299',
    desc: 'For funds, quant teams, and developers building on top of whale data.',
    features: [
      { text: 'Everything in Pro' },
      { text: 'Unlimited wallet alerts' },
      { text: 'REST + WebSocket API' },
      { text: 'Custom chain indexing' },
      { text: 'Dedicated Telegram bot' },
      { text: 'SLA guarantee (99.9%)' },
      { text: 'Priority support' },
    ],
    btnClass: 'btn-plan-outline',
    btnLabel: 'Contact sales',
  },
]

export default function Pricing(): React.ReactElement {
  return (
    <section className="pricing-section" id="pricing">
      <div className="section-label" style={{ justifyContent: 'center' }}>Pricing</div>
      <h2>Start free. Scale as you grow.</h2>
      <p className="pricing-sub">No contracts. Cancel anytime. All plans include access to Ethereum &amp; Solana.</p>
      <div className="pricing-grid">
        {plans.map((plan) => (
          <div key={plan.name} className={`price-card${plan.popular ? ' popular' : ''}`}>
            {plan.popular && <div className="popular-badge">MOST POPULAR</div>}
            <div className="plan-name">{plan.name}</div>
            <div className="plan-price">
              {plan.price}<span>/mo</span>
            </div>
            <div className="plan-desc">{plan.desc}</div>
            <ul className="plan-features">
              {plan.features.map((f) => (
                <li key={f.text} className={f.muted ? 'muted' : ''}>
                  {f.text}
                </li>
              ))}
            </ul>
            <button className={`btn-plan ${plan.btnClass}`}>{plan.btnLabel}</button>
          </div>
        ))}
      </div>
    </section>
  )
}
