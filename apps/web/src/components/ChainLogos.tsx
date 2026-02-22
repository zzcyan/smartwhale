const chains = [
  { icon: '⬡', name: 'Ethereum' },
  { icon: '◎', name: 'Solana' },
  { icon: '⬡', name: 'BNB Chain' },
  { icon: '🔵', name: 'Base' },
  { icon: '🔷', name: 'Arbitrum' },
  { icon: '🟣', name: 'Polygon' },
  { icon: '🔴', name: 'Optimism' },
  { icon: '₿',  name: 'Bitcoin' },
]

export default function ChainLogos(): React.ReactElement {
  return (
    <div className="chain-logos">
      <span className="chain-logos-label">Chains</span>
      {chains.map((c) => (
        <div key={c.name} className="chain-logo">
          <span className="chain-logo-icon">{c.icon}</span>
          {c.name}
        </div>
      ))}
    </div>
  )
}
