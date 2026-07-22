import { CarFront } from 'lucide-react'
import { layout } from '../../designSystem'

export function Hero({ compact }: { compact: boolean }) {
  return <section className={layout(`hero${compact ? ' hero-compact' : ''}`)} data-layout={compact ? 'compact' : 'full'} aria-labelledby="page-title">
    <div className={layout('eyebrow')}><CarFront size={16} /> Fair fuel costs, leg by leg</div>
    <h1 id="page-title">Plan the route.<br /><span>Split the ride.</span></h1>
    <p>Build your journey, choose who rode each leg, and get a fair fuel split in seconds.</p>
  </section>
}
