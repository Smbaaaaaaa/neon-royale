import { useEffect, useRef, useState } from 'react'
import { useWallet } from '../context/Wallet.jsx'
import { sfx } from '../audio.js'
import BetBar from './BetBar.jsx'
import Cabinet from './Cabinet.jsx'
import { useWin, tierOf } from './WinBanner.jsx'
const MULTS = [24, 6, 2.2, 1.3, 0.55, 0.3, 0.55, 1.3, 2.2, 6, 24]
const fmt = n => Number(n).toLocaleString('de-DE'), fm = m => String(m).replace('.', ',')
const DX = 12, DY = 22, TOP = 50
const px = (k, s) => 150 + (2 * s - k) * DX, py = k => TOP + k * DY
export default function Plinko() {
  const { p, adjust, refresh, call } = useWallet(), showWin = useWin()
  const [bet, setBet] = useState(10), [busy, setBusy] = useState(false), [ball, setBall] = useState(null), [hit, setHit] = useState(null), [res, setRes] = useState(null), [err, setErr] = useState('')
  const raf = useRef(0)
  useEffect(() => () => cancelAnimationFrame(raf.current), [])
  const play = async () => {
    if (busy || p.coins < bet) return
    sfx.unlock(); setBusy(true); setErr(''); setHit(null); setRes(null)
    const r = await call('play_plinko', { p_bet: bet })
    if (r?.error) { setBusy(false); setErr(r.error); return }
    adjust(-bet); sfx.chip()
    const pts = [[150, 16], [150, py(0) - 8]]; let s = 0
    r.path.forEach((b, i) => { s += b; const k = i + 1; pts.push([px(k, s), k < 10 ? py(k) - 8 : py(10) + 12]) })
    const T = 190, total = T * (pts.length - 1), t0 = performance.now(); let last = -1
    const step = now => {
      const t = Math.min(now - t0, total), i = Math.min(pts.length - 2, Math.floor(t / T)), q = (t - i * T) / T
      const [x0, y0] = pts[i], [x1, y1] = pts[i + 1]
      setBall([x0 + (x1 - x0) * q, y0 + (y1 - y0) * q - Math.sin(Math.PI * q) * 7])
      if (i !== last) { last = i; sfx.tick() }
      if (t < total) raf.current = requestAnimationFrame(step)
      else {
        const pay = Number(r.pay); setHit(r.slot); setRes(r); refresh()
        if (pay > 0) sfx.win(pay >= bet * 10 ? 'jackpot' : pay > bet ? 'big' : 'small'); else sfx.lose()
        if (pay > bet) showWin(pay - bet, tierOf(pay - bet, bet)); setBusy(false)
      }
    }
    raf.current = requestAnimationFrame(step)
  }
  return (
    <main className="table-page"><h1>Royal Plinko</h1>
      <Cabinet title="Royal Plinko" deck={<>
        <BetBar bet={bet} setBet={setBet} disabled={busy} coins={p.coins} />
        <button className="arc-btn" disabled={busy || p.coins < bet} onClick={play}>Kugel werfen, {fmt(bet)} RC</button></>}>
        <svg viewBox="0 0 300 312" className="plinko" aria-label="Plinko-Feld">
          <defs><radialGradient id="plball" cx=".35" cy=".3" r=".8"><stop offset="0" stopColor="#fff3b0" /><stop offset="1" stopColor="#c9a24a" /></radialGradient></defs>
          {Array.from({ length: 10 }, (_, k) => Array.from({ length: k + 1 }, (_, j) => <circle key={k + '-' + j} cx={150 + (2 * j - k) * DX} cy={py(k)} r="2.6" fill="#d9dce1" />))}
          {MULTS.map((m, s) => <g key={s}><rect x={px(10, s) - 11} y={py(10) + 2} width="22" height="30" rx="4" className={'bucket' + (hit === s ? ' hit' : '') + (m >= 5 ? ' hi' : m >= 1 ? ' mid' : '')} />
            <text x={px(10, s)} y={py(10) + 22} textAnchor="middle" className="bt">×{fm(m)}</text></g>)}
          {ball && <circle cx={ball[0]} cy={ball[1]} r="5.5" fill="url(#plball)" />}
        </svg>
        <p className="cab-msg" role="status">{err || (res ? (Number(res.pay) > 0 ? `×${fm(res.mult / 100)} · +${fmt(res.pay)} RC` : 'Kein Gewinn') : 'Wirf die Kugel und hoffe auf die Ränder.')}</p>
      </Cabinet>
    </main>
  )
}
