import { useEffect, useState } from 'react'
import { sfx } from '../audio.js'
const CRACKS = [
  'M200 100L170 85L150 90L120 70L95 72L60 50', 'M200 100L225 80L240 84L262 58L290 60L330 35', 'M200 100L215 125L205 150L225 170L220 195',
  'M200 100L180 120L160 118L135 145L110 150L80 175', 'M200 100L260 105L285 125L320 120L365 140', 'M200 100L140 100L110 108L70 100L30 112',
  'M200 100L195 70L205 45L192 20L200 2', 'M200 100L235 140L270 160L300 190', 'M150 90L140 60L120 45', 'M285 125L300 150L330 160',
]
const reduce = () => window.matchMedia?.('(prefers-reduced-motion: reduce)').matches
// Erst leer, dann fällt das Spiel vom Himmel, schlägt auf und hinterlässt Risse im Boden.
export default function Entrance({ children }) {
  const [phase, setPhase] = useState(reduce() ? 'landed' : 'wait')
  useEffect(() => {
    if (reduce()) return
    const a = setTimeout(() => setPhase('fall'), 150), b = setTimeout(() => { setPhase('landed'); sfx.thud() }, 750)
    return () => { clearTimeout(a); clearTimeout(b) }
  }, [])
  return (
    <div className={'entrance ' + phase}>
      <div className="crack-floor" aria-hidden="true">
        <svg viewBox="0 0 400 200">{CRACKS.map((d, i) => <g key={i} style={{ animationDelay: i * 35 + 'ms' }} className="crack">
          <path d={d} pathLength="1" className="c-dark" /><path d={d} pathLength="1" className="c-glow" /></g>)}</svg>
        {Array.from({ length: 9 }, (_, i) => <i key={i} className="puff" style={{ '--x': (i - 4) * 11 + '%', '--d': i * 25 + 'ms' }} />)}
      </div>
      <div className="dropper">{children}</div>
    </div>
  )
}
