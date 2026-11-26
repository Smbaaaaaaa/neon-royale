import { useState } from 'react'
import { useWallet } from '../context/Wallet.jsx'
import { sfx } from '../audio.js'
import BetBar from './BetBar.jsx'
import Cabinet from './Cabinet.jsx'
import { useWin, tierOf } from './WinBanner.jsx'
const MULTS = [0, 0.5, 0, 1, 0.5, 0, 1.5, 1, 0, 2.5, 0.5, 4], A = 30
const fmt = n => Number(n).toLocaleString('de-DE'), fm = m => String(m).replace('.', ',')
const pt = (deg, r) => [r * Math.sin(deg * Math.PI / 180), -r * Math.cos(deg * Math.PI / 180)]
const fill = m => (m === 0 ? '#16161a' : m < 1 ? '#3a0c14' : m === 1 ? '#25252b' : m < 4 ? '#6a1a24' : '#c9a24a')
export default function Wheel() {
  const { p, adjust, refresh, call } = useWallet(), showWin = useWin()
  const [bet, setBet] = useState(10), [busy, setBusy] = useState(false), [rot, setRot] = useState(0), [res, setRes] = useState(null), [err, setErr] = useState('')
  const spin = async () => {
    if (busy || p.coins < bet) return
    sfx.unlock(); setBusy(true); setErr(''); setRes(null)
    const r = await call('play_wheel', { p_bet: bet })
    if (r?.error) { setBusy(false); setErr(r.error); return }
    adjust(-bet); sfx.chip()
    setRot(v => v + 1800 + ((((-r.seg * A - v) % 360) + 360) % 360))
    const tick = setInterval(sfx.tick, 120); setTimeout(() => clearInterval(tick), 4000)
    setTimeout(() => {
      const pay = Number(r.pay); setRes(r); refresh()
      if (pay > 0) sfx.win(pay >= bet * 4 ? 'jackpot' : pay > bet ? 'big' : 'small'); else sfx.lose()
      if (pay > bet) showWin(pay - bet, tierOf(pay - bet, bet)); setBusy(false)
    }, 4700)
  }
  return (
    <main className="table-page"><h1>Glücksrad</h1>
      <Cabinet title="Glücksrad" deck={<>
        <BetBar bet={bet} setBet={setBet} disabled={busy} coins={p.coins} />
        <button className="arc-btn" disabled={busy || p.coins < bet} onClick={spin}>Drehen, {fmt(bet)} RC</button></>}>
        <div className="wheelbox">
          <svg viewBox="-110 -110 220 220" className="wheelsvg" style={{ transform: `rotate(${rot}deg)`, transition: 'transform 4.5s cubic-bezier(.12,.6,.1,1)' }} aria-label="Glücksrad">
            <circle r="108" fill="#c9a24a" />
            {MULTS.map((m, i) => { const [x0, y0] = pt(i * A - A / 2, 100), [x1, y1] = pt(i * A + A / 2, 100), [tx, ty] = pt(i * A, 78)
              return <g key={i}><path d={`M0 0L${x0} ${y0}A100 100 0 0 1 ${x1} ${y1}Z`} fill={fill(m)} stroke="#c9a24a" strokeWidth=".8" />
                <text x={tx} y={ty} transform={`rotate(${i * A} ${tx} ${ty})`} textAnchor="middle" dominantBaseline="middle" fontSize="13" fontWeight="800" fill={m === 4 ? '#1a1204' : '#efe9dc'}>×{fm(m)}</text></g> })}
            <circle r="16" fill="#0b0b0d" stroke="#c9a24a" strokeWidth="3" />
          </svg>
          <div className="wpointer" />
        </div>
        <p className="cab-msg" role="status">{err || (res ? (Number(res.pay) > 0 ? `×${fm(res.mult / 100)} · +${fmt(res.pay)} RC` : 'Leider nichts') : 'Dreh am Rad.')}</p>
      </Cabinet>
    </main>
  )
}
