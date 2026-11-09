import { useEffect, useMemo, useRef, useState } from 'react'
import { useWallet } from '../context/Wallet.jsx'
import { sfx } from '../audio.js'
import BetBar from './BetBar.jsx'
import Coin from './Coin.jsx'
import Logo from './Logo.jsx'
import TableDice from './TableDice.jsx'
import { useWin, tierOf } from './WinBanner.jsx'
const fmt = n => Number(n).toLocaleString('de-DE')
const PAY = [['spade', 2], ['chip', 3], ['dice', 5], ['heart', 10], ['diamond', 25], ['crown', 100]]
const Sym = ({ s }) => (
  <svg viewBox="0 0 40 40" aria-label={s}>
    {s === 'spade' && <path d="M20 5C20 5 8 15 8 24C8 30 14 32 18 28C17 33 15 36 13 37H27C25 36 23 33 22 28C26 32 32 30 32 24C32 15 20 5 20 5Z" fill="#efe9dc" />}
    {s === 'chip' && <><circle cx="20" cy="20" r="14" fill="#17171b" stroke="#c9ccd2" strokeWidth="2.5" /><circle cx="20" cy="20" r="9" fill="none" stroke="#c9ccd2" strokeWidth="3" strokeDasharray="4 3.2" /><circle cx="20" cy="20" r="4" fill="#c9ccd2" /></>}
    {s === 'dice' && <><rect x="7" y="7" width="26" height="26" rx="6" fill="#17171b" stroke="#c9ccd2" strokeWidth="2" />{[[14, 14], [26, 14], [20, 20], [14, 26], [26, 26]].map(([x, y], i) => <circle key={i} cx={x} cy={y} r="2.4" fill="#efe9dc" />)}</>}
    {s === 'heart' && <path d="M20 34C5 24 6 11 14 11C17 11 20 13 20 16C20 13 23 11 26 11C34 11 35 24 20 34Z" fill="#8a1626" stroke="#c4455a" strokeWidth="1.4" />}
    {s === 'diamond' && <><polygon points="20,5 34,16 20,35 6,16" fill="#cfd2d8" stroke="#8d9199" strokeWidth="1.2" /><path d="M6 16H34M14 16L20 5L26 16L20 35Z" fill="none" stroke="#8d9199" /></>}
    {s === 'crown' && <><path d="M6 30L4 13L13 20L20 7L27 20L36 13L34 30Z" fill="#d9b45a" stroke="#8a6a1c" strokeWidth="1.2" strokeLinejoin="round" /><rect x="6" y="29" width="28" height="5" rx="1.5" fill="#d9b45a" stroke="#8a6a1c" /></>}
  </svg>
)

function Ticket({ t, onDone, onRemove }) {
  const cv = useRef(null), coin = useRef(null), last = useRef(null), raf = useRef(0), fin = useRef(false), drag = useRef(false), tick = useRef(0)
  const [phase, setPhase] = useState('ready')
  const rot = useMemo(() => ((parseInt(t.id.slice(0, 4), 16) % 9) - 4) * 1.2, [t.id])
  const tier = t.price >= 500 ? 'black' : t.price >= 100 ? 'gold' : t.price >= 20 ? 'silver' : 'basic'
  useEffect(() => { // Rubbelfolie malen: gebürstetes Silber mit Muster
    const c = cv.current.getContext('2d'), g = c.createLinearGradient(0, 0, 300, 300)
    g.addColorStop(0, '#d5d8de'); g.addColorStop(0.35, '#868b94'); g.addColorStop(0.55, '#e6e8ec'); g.addColorStop(1, '#7b8089')
    c.fillStyle = g; c.fillRect(0, 0, 300, 300); c.strokeStyle = 'rgba(255,255,255,.18)'
    for (let i = -300; i < 300; i += 6) { c.beginPath(); c.moveTo(i, 0); c.lineTo(i + 300, 300); c.stroke() }
    c.save(); c.translate(150, 150); c.rotate(-0.35); c.fillStyle = 'rgba(20,20,24,.2)'; c.font = '800 20px serif'; c.textAlign = 'center'
    for (let y = -230, r = 0; y < 230; y += 44, r++) for (let x = -260; x < 260; x += 110) c.fillText('ROYALE', x + (r % 2 ? 55 : 0), y)
    c.restore(); c.fillStyle = 'rgba(10,10,12,.55)'; c.font = '700 26px sans-serif'; c.textAlign = 'center'; c.fillText('RUBBELN', 150, 158)
  }, [])
  useEffect(() => () => cancelAnimationFrame(raf.current), [])
  const pos = e => { const r = cv.current.getBoundingClientRect(); return [(e.clientX - r.left) * 300 / r.width, (e.clientY - r.top) * 300 / r.height] }
  const spot = (x, y) => { const r = cv.current.getBoundingClientRect(), k = r.width / 300; coin.current.style.transform = `translate(${x * k}px,${y * k}px) translate(-50%,-50%) rotate(${Math.sin(x / 17) * 14}deg)` }
  const erase = (x, y, w = 38) => {
    const c = cv.current.getContext('2d'); c.globalCompositeOperation = 'destination-out'; c.lineWidth = w; c.lineCap = 'round'
    c.beginPath(); c.moveTo(last.current?.x ?? x, last.current?.y ?? y); c.lineTo(x, y); c.stroke(); last.current = { x, y }; sfx.scratch()
  }
  const cleared = () => { const d = cv.current.getContext('2d').getImageData(0, 0, 300, 300).data; let n = 0, m = 0; for (let i = 3; i < d.length; i += 4 * 29) { m++; if (d[i] < 40) n++ } return n / m }
  const finish = () => { if (fin.current) return; fin.current = true; drag.current = false; cancelAnimationFrame(raf.current); setPhase('done'); onDone(t) }
  const down = e => { if (phase === 'done' || phase === 'auto') return; drag.current = true; cv.current.setPointerCapture(e.pointerId); setPhase('scratching'); const [x, y] = pos(e); last.current = null; erase(x, y); spot(x, y) }
  const move = e => {
    if (!drag.current) return; const [x, y] = pos(e); erase(x, y); spot(x, y)
    if (performance.now() - tick.current > 250) { tick.current = performance.now(); if (cleared() > 0.55) finish() }
  }
  const up = () => { drag.current = false; last.current = null; if (phase === 'scratching') { if (cleared() > 0.55) finish(); else setPhase('ready') } }
  const auto = () => { // die Royal-Münze rubbelt das Los selbst frei
    if (phase !== 'ready') return
    setPhase('auto'); last.current = null; const rows = 7, dur = 2600, t0 = performance.now()
    const step = now => {
      const p = Math.min(1, (now - t0) / dur), rr = p * rows, row = Math.min(rows - 1, Math.floor(rr)), q = rr - row
      const x = 22 + (row % 2 ? 1 - q : q) * 256, y = 28 + row * 40 + Math.sin(q * 10) * 5
      erase(x, y, 46); spot(x, y)
      if (p < 1) raf.current = requestAnimationFrame(step); else finish()
    }
    raf.current = requestAnimationFrame(step)
  }
  const done = phase === 'done', coinOn = phase === 'scratching' || phase === 'auto'
  return (
    <div className={'ticket tk-' + tier + (done ? ' done' : '')} style={{ '--rot': rot + 'deg' }}>
      <div className="thead"><Logo /><b>{fmt(t.price)} RC</b></div>
      <div className="tgrid">
        <div className="tcells">{t.grid.map((s, i) => <div key={i} className={'tcell' + (done && t.symbol === s ? ' win' : '')}><Sym s={s} /></div>)}</div>
        <canvas ref={cv} width="300" height="300" className={'tfoil' + (done ? ' gone' : '')} onPointerDown={down} onPointerMove={move} onPointerUp={up} onPointerCancel={up} />
        <div ref={coin} className={'tcoin' + (coinOn ? ' on' : '')}><Coin size={46} /></div>
      </div>
      <div className="tfoot">
        {done ? <><p className={t.symbol ? 'twin' : 'tlose'}>{t.symbol ? `3 gleiche: ×${t.mult} = ${fmt(t.payout)} RC` : 'Leider kein Gewinn'}</p>
          <button className="btn sm ghost" onClick={() => onRemove(t.id)}>Weglegen</button></>
          : <><button className="btn sm" disabled={phase !== 'ready'} onClick={auto}>Mit Münze rubbeln</button><small className="muted">oder selbst rubbeln</small></>}
      </div>
    </div>
  )
}

export default function Scratch() {
  const { p, adjust, refresh, call } = useWallet(); const showWin = useWin()
  const [price, setPrice] = useState(10), [tickets, setTickets] = useState([]), [err, setErr] = useState(''), [busy, setBusy] = useState(false)
  useEffect(() => { call('scratch_list').then(r => { if (!r?.error) setTickets(r) }) }, [call])
  const buy = async () => {
    setBusy(true); setErr(''); sfx.unlock()
    const r = await call('scratch_buy', { p_price: price }); setBusy(false)
    if (r?.error) return setErr(r.error)
    adjust(-price); sfx.chip(); setTickets(l => [...l, r])
  }
  const reveal = async t => {
    const r = await call('scratch_reveal', { p_id: t.id })
    if (r?.error) { setErr(r.error); return }
    refresh(); const pay = Number(r.payout)
    if (pay > 0) { sfx.win(pay >= t.price * 25 ? 'jackpot' : pay >= t.price * 5 ? 'big' : 'small'); if (pay > t.price) showWin(pay - t.price, tierOf(pay - t.price, t.price)) } else sfx.lose()
  }
  return (
    <main className="table-page">
      <h1>Rubbellose</h1>
      <div className="rail"><div className="felt scratch-table">
        <TableDice />
        {!tickets.length && <p className="msg-felt">Der Tisch ist leer. Kauf ein Los und lass die Royal-Münze die Folie freirubbeln.</p>}
        <div className="tickets">{tickets.map(t => <Ticket key={t.id} t={t} onDone={reveal} onRemove={id => setTickets(l => l.filter(x => x.id !== id))} />)}</div>
      </div></div>
      <BetBar bet={price} setBet={setPrice} disabled={busy} coins={p.coins} label="Preis des Loses" />
      <div className="row center"><button className="btn" disabled={busy || p.coins < price} onClick={buy}>Los kaufen, {fmt(price)} RC</button></div>
      {err && <p className="muted center-t">{err}</p>}
      <div className="paylegend">{PAY.map(([s, m]) => <span key={s}><i className="lg"><Sym s={s} /></i>×{m}</span>)}</div>
      <p className="muted center-t">Drei gleiche Symbole gewinnen das Vielfache deines Preises. Das Ergebnis steht beim Kauf fest, der Gewinn wird beim Aufdecken gutgeschrieben.</p>
    </main>
  )
}
