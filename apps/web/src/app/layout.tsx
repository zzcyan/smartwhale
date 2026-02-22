import type { Metadata } from 'next'
import { Syne, DM_Mono, DM_Sans } from 'next/font/google'
import './globals.css'

const syne = Syne({
  subsets: ['latin'],
  weight: ['400', '600', '700', '800'],
  variable: '--font-syne',
  display: 'swap',
})

const dmMono = DM_Mono({
  subsets: ['latin'],
  weight: ['300', '400', '500'],
  variable: '--font-dm-mono',
  display: 'swap',
})

const dmSans = DM_Sans({
  subsets: ['latin'],
  weight: ['300', '400', '500', '600', '700'],
  variable: '--font-dm-sans',
  display: 'swap',
})

export const metadata: Metadata = {
  title: 'SmartWhale — Follow the Smart Money',
  description:
    'SmartWhale ranks crypto wallets by ROI, win rate, and pattern consistency — not just capital. Copy the whales that actually win.',
}

export default function RootLayout({
  children,
}: {
  readonly children: React.ReactNode
}): React.ReactElement {
  return (
    <html lang="en" className={`${syne.variable} ${dmMono.variable} ${dmSans.variable}`}>
      <body>{children}</body>
    </html>
  )
}
