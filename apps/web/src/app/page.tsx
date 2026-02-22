'use client'

import { useEffect } from 'react'
import Navbar from '@/components/Navbar'
import Hero from '@/components/Hero'
import ChainLogos from '@/components/ChainLogos'
import FeedTable from '@/components/FeedTable'
import Features from '@/components/Features'
import WhaleScore from '@/components/WhaleScore'
import AlertsPanel from '@/components/AlertsPanel'
import Pricing from '@/components/Pricing'
import CTA from '@/components/CTA'
import Footer from '@/components/Footer'

export default function HomePage(): React.ReactElement {
  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((e) => {
          if (e.isIntersecting) {
            const target = e.target as HTMLElement
            target.style.opacity = '1'
            target.style.transform = 'translateY(0)'
          }
        })
      },
      { threshold: 0.1 },
    )

    const els = document.querySelectorAll('.feat-card, .price-card, .whale-row, .alert-item')
    els.forEach((el) => {
      const htmlEl = el as HTMLElement
      htmlEl.style.opacity = '0'
      htmlEl.style.transform = 'translateY(20px)'
      htmlEl.style.transition = 'opacity 0.5s ease, transform 0.5s ease'
      observer.observe(el)
    })

    return () => observer.disconnect()
  }, [])

  return (
    <>
      <Navbar />
      <Hero />
      <ChainLogos />
      <FeedTable />
      <Features />
      <WhaleScore />
      <AlertsPanel />
      <Pricing />
      <CTA />
      <Footer />
    </>
  )
}
