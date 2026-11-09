import { useWallet } from '../context/Wallet.jsx'
import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react'
const Ctx = createContext(() => {})
export const useWin = () => useContext(Ctx)
export const tierOf = (net, stake) => (net >= stake * 20 ? 'jackpot' : net >= stake * 5 ? 'big' : 'small')
const LABEL = { small: 'GEWINN!', big: 'GROSSER GEWINN!', jackpot: 'JACKPOT!' }
const DUR = { small: 3000, big: 3800, jackpot: 5000 }
const SPARKS = { small: 26, big: 44, jackpot: 80 }

function Count({ to }) {
  const [v, setV] = useState(0)
  useEffect(() => {
    let raf, t0
    const run = t => {
      t0 ??= t
      const k = Math.max(0, Math.min(1, (t - t0 - 500) / 1300))
      setV(Math.round(to * (1 - (1 - k) ** 3)))
      if (t - t0 < 1900) raf = requestAnimationFrame(run); else setV(to)
    }
    raf = requestAnimationFrame(run)
    return () => cancelAnimationFrame(raf)
  }, [to])
  return v.toLocaleString('de-DE')
}

function Banner({ amount, tier, label }) {
  const { p } = useWallet()
  const sparks = useMemo(() => Array.from({ length: SPARKS[tier] }, () => {
    const a = Math.random() * 6.283, d = 25 + Math.random() * 45
    return { '--x': Math.cos(a) * d + 'vmin', '--y': Math.sin(a) * d * 0.8 + 'vmin', '--sz': 6 + Math.random() * 14 + 'px', '--d': 0.5 + Math.random() * 0.5 + 's' }
  }), [])
  return (
    <div className={'win-fx t-' + tier} aria-live="polite" style={{ '--dur': DUR[tier] + 'ms' }}>
      <div className="win-flash" />
      {p?.eq?.anim === 'the-house' && <div className="house-fx"><i /><i /><i /></div>}
      {sparks.map((s, i) => <i key={i} className="spark" style={s} />)}
      <div className="win-text">
        <div className="win-label">{label || LABEL[tier]}</div>
        <div className="win-amt">+<Count to={amount} /> <small>RC</small></div>
      </div>
    </div>
  )
}

export function WinProvider({ children }) {
  const [w, setW] = useState(null)
  const show = useCallback((amount, tier = 'small', label) => setW({ id: Math.random(), amount, tier, label }), [])
  useEffect(() => { if (!w) return; const t = setTimeout(() => setW(null), DUR[w.tier]); return () => clearTimeout(t) }, [w])
  return <Ctx.Provider value={show}>{children}{w && <Banner key={w.id} {...w} />}</Ctx.Provider>
}
