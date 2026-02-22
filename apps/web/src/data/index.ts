export interface Token {
  name: string
  chain: string
  icon: string
  color: string
}

export interface Wallet {
  addr: string
  name: string
}

export interface WhaleEntry {
  emoji: string
  addr: string
  type: string
  pnl: string
  wr: string
  score: number
}

export type AlertType = 'buy' | 'sell' | 'accumulate'

export interface AlertEntry {
  type: AlertType
  icon: string
  title: string
  meta: string
  amount: string
  time: string
}

export const tokens: Token[] = [
  { name: 'VIRTUAL', chain: 'BASE', icon: '🔵', color: '#3b82f6' },
  { name: 'WIF',     chain: 'SOL',  icon: '🐕', color: '#f59e0b' },
  { name: 'PEPE',    chain: 'ETH',  icon: '🐸', color: '#22c55e' },
  { name: 'JUP',     chain: 'SOL',  icon: '🪐', color: '#8b5cf6' },
  { name: 'PENDLE',  chain: 'ETH',  icon: '⚡', color: '#06b6d4' },
  { name: 'GMX',     chain: 'ARB',  icon: '🔷', color: '#6366f1' },
  { name: 'AERO',    chain: 'BASE', icon: '✈️', color: '#0ea5e9' },
  { name: 'BONK',    chain: 'SOL',  icon: '🔨', color: '#f97316' },
]

export const wallets: Wallet[] = [
  { addr: '0x3a4f...8c21', name: 'Precision Trader #1' },
  { addr: '0x7b2e...4d90', name: 'DeFi Insider #7' },
  { addr: 'GwvX...3kP8',   name: 'Solana Alpha Whale' },
  { addr: '0x91cc...2f17', name: 'Multi-Chain Giant' },
  { addr: '0x5aB3...e8d4', name: 'Narrative Trader #3' },
  { addr: 'Fh7z...9mLq',   name: 'SOL Degen #12' },
]

export const scores: number[] = [94, 87, 91, 78, 96, 83, 89, 72]
export const amounts: string[] = ['$1.24M', '$380K', '$2.1M', '$670K', '$890K', '$4.3M', '$220K', '$1.9M']

export const whaleData: WhaleEntry[] = [
  { emoji: '🦅', addr: '0x3a4f...8c21', type: 'Narrative Trader', pnl: '+$14.2M', wr: '87% win rate', score: 96 },
  { emoji: '🤖', addr: 'GwvX...3kP8',   type: 'DeFi Insider',     pnl: '+$8.9M',  wr: '82% win rate', score: 94 },
  { emoji: '🎯', addr: '0x91cc...2f17', type: 'Early Adopter',     pnl: '+$22.1M', wr: '79% win rate', score: 91 },
  { emoji: '⚡', addr: '0x5aB3...e8d4', type: 'Quant Degen',       pnl: '+$6.4M',  wr: '91% win rate', score: 89 },
  { emoji: '🐋', addr: 'Fh7z...9mLq',   type: 'Multi-chain Whale', pnl: '+$31.7M', wr: '74% win rate', score: 87 },
]

export const alertsData: AlertEntry[] = [
  { type: 'buy',        icon: '↗', title: '0x3a4f...8c21 bought WIF',       meta: 'Solana · Score 96',        amount: '+$1.24M',   time: '12s ago' },
  { type: 'accumulate', icon: '📦', title: 'Silent accumulation detected',  meta: 'PENDLE · ETH · 3 wallets', amount: 'CONFLUENCE', time: '2m ago'  },
  { type: 'buy',        icon: '↗', title: 'GwvX...3kP8 entered VIRTUAL',    meta: 'Base · Score 94',          amount: '+$880K',    time: '4m ago'  },
  { type: 'sell',       icon: '↘', title: 'DeFi Insider #7 exiting GMX',    meta: 'Arbitrum · Score 87',      amount: '-$2.1M',    time: '9m ago'  },
  { type: 'buy',        icon: '↗', title: '0x91cc...2f17 accumulating JUP', meta: 'Solana · Score 91',        amount: '+$430K',    time: '15m ago' },
]
