import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { useWallet } from '../context/Wallet.jsx'
import { BETS } from '../games/registry.js'
import { LINES, PAYS, spinGrid, evaluate, randSymbol, tier } from '../games/slotLogic.js'
import { sfx, setVolume, setMuted, getAudio } from '../audio.js'
import Coin from './Coin.jsx'
import { useWin } from './WinBanner.jsx'

const NAMES = { cherry: 'Kirsche', lemon: 'Zitrone', bell: 'Glocke', bar: 'BAR', seven: 'Sieben', diamond: 'Diamant' }
const GLYPH = { cherry: '🍒', lemon: '🍋', bell: '🔔', diamond: '💎' }
const Sym = ({ s }) => <div className={`sym s-${s}`} aria-label={NAMES[s]}>{s === 'bar' ? <b>BAR</b> : s === 'seven' ? <b>7</b> : GLYPH[s]}</div>
const initial = () => Array.from({ length: 3 }, randSymbol)
const TRAVEL = 90

function Reel({ index, spin, onStop, hot }) {
  const strip = useRef(), prev = useRef(null)
  if (!prev.current) prev.current = initial()
  const cells = useMemo(() => spin.id ? [...prev.current, ...Array.from({ length: 16 + index * 6 }, randSymbol), ...spin.final] : prev.current, [spin.id])
  useLayoutEffect(() => {
    if (!spin.id) return
    const el = strip.current, dur = 1500 + index * 420 + (index === 4 ? 600 : 0)
    el.style.transition = 'none'; el.style.transform = 'translateY(0)'; el.classList.add('moving'); void el.offsetHeight
    el.style.transition = `transform ${dur}ms cubic-bezier(.3,.55,.25,1.04)`
    el.style.transform = `translateY(-${((cells.length - 3) / cells.length) * 100}%)`
    const t = setTimeout(() => { el.classList.remove('moving'); prev.current = spin.final; onStop(index) }, dur)
    return () => clearTimeout(t)
  }, [spin.id])
  return (
    <div className="reel"><div className="strip" ref={strip}>
      {cells.map((s, i) => <div key={i} className={'cell' + (hot.has(i - (cells.length - 3)) && spin.id ? ' hot' : '')}><Sym s={s} /></div>)}
    </div></div>
  )
}

function Tray({ burst }) {
  const box = useRef(), [ids, setIds] = useState([])
  useEffect(() => { setIds(Array.from({ length: burst.n }, (_, i) => `${burst.id}-${i}`)) }, [burst.id])
  return <div className="tray" ref={box}><div className="chute" />{ids.map((k, i) => <Falling key={k} box={box} delay={i * 110} />)}</div>
}
function Falling({ box, delay }) {
  const el = useRef()
  useEffect(() => {
    const W = box.current.clientWidth, H = box.current.clientHeight, S = 30
    let x = W / 2 - S / 2, y = -S, vx = (Math.random() - 0.5) * 7, vy = 0, rot = 0, vr = (Math.random() - 0.5) * 20, raf, hits = 0, go = false
    const t0 = setTimeout(() => { go = true; sfx.coin() }, delay)
    const step = () => {
      if (go) {
        vy += 0.7; x += vx; y += vy; rot += vr
        if (x < 0 || x > W - S) { vx *= -0.6; x = Math.max(0, Math.min(W - S, x)) }
        if (y > H - S) { y = H - S; if (Math.abs(vy) > 2) { vy *= -0.45; hits++; if (hits < 3) sfx.coin() } else vy = 0; vx *= 0.9; vr *= 0.85 }
        el.current.style.transform = `translate(${x}px,${y}px) rotateY(${rot}deg)`
        if (y >= H - S && Math.abs(vx) < 0.05 && vy === 0) return
      }
      raf = requestAnimationFrame(step)
    }
    raf = requestAnimationFrame(step)
    return () => { cancelAnimationFrame(raf); clearTimeout(t0) }
  }, [])
  return <div className="fcoin" ref={el}><Coin size={30} /></div>
}

export default function Slots() {
  const { p, adjust, refresh, playSlots, claimRescue, rescueReady, RESCUE } = useWallet()
  const showWin = useWin()
  const [spin, setSpin] = useState(Array.from({ length: 5 }, () => ({ id: 0, final: null })))
  const [busy, setBusy] = useState(false), [result, setResult] = useState(null), [burst, setBurst] = useState({ id: 0, n: 0 })
  const [pull, setPull] = useState(0), [drag, setDrag] = useState(false), [audio, setAudio] = useState(getAudio())
  const stopped = useRef(0), pending = useRef(null), tickRef = useRef(), idRef = useRef(0), start = useRef(0)
  const [bet, setBet] = useState(2)
  const canSpin = !busy && p.coins >= bet

  const doSpin = async () => {
    if (!canSpin) return
    sfx.unlock(); sfx.lever(); setBusy(true)
    const r = await playSlots(bet)
    if (r.error) { setBusy(false); setResult({ err: r.error, total: 0, wins: [], tier: 'none' }); return }
    adjust(-bet)
    pending.current = { grid: r.grid, bet, wins: r.wins, total: Number(r.total) }
    stopped.current = 0; idRef.current++; setResult(null); setBurst({ id: idRef.current, n: 0 })
    setSpin(r.grid.map(final => ({ id: idRef.current, final })))
    clearInterval(tickRef.current); tickRef.current = setInterval(sfx.tick, 85)
  }
  const onStop = i => {
    sfx.stop()
    if (++stopped.current < 5) return
    clearInterval(tickRef.current)
    const r = pending.current, t = tier(r.total, r.bet)
    setResult({ ...r, tier: t }); setBusy(false); refresh(); if (r.total > r.bet) showWin(r.total, t)
    if (r.total) { sfx.win(t); setBurst({ id: idRef.current, n: Math.min(24, 4 + Math.round(r.total / r.bet * 2)) }) }
  }
  useEffect(() => () => clearInterval(tickRef.current), [])
  useEffect(() => { if (!busy && p.coins < bet) setBet(BETS.filter(b => b <= p.coins).pop() || BETS[0]) }, [p.coins, busy])

  const hotCells = useMemo(() => {
    const m = Array.from({ length: 5 }, () => new Set())
    result?.wins.forEach(w => { for (let i = 0; i < w.count; i++) m[i].add(LINES[w.line][i]) })
    return m
  }, [result])

  // Hebel: ziehen per Maus/Finger, bei >80 % löst er aus und federt zurück
  const down = e => { if (!canSpin) return; e.currentTarget.setPointerCapture(e.pointerId); start.current = e.clientY; setDrag(true) }
  const move = e => drag && setPull(Math.max(0, Math.min(1, (e.clientY - start.current) / TRAVEL)))
  const up = () => { if (!drag) return; setDrag(false); const hit = pull > 0.8; setPull(0); if (hit) doSpin() }
  const keyLever = e => { if ((e.key === 'Enter' || e.key === ' ') && canSpin) { e.preventDefault(); setPull(1); setTimeout(() => setPull(0), 180); doSpin() } }

  return (
    <main className="slots-page">
      <div className="machine-wrap">
        <div className={`machine skin-${p.eq.skin} ${result ? 'win-' + result.tier : ''}`}>
          <div className="marquee"><span>SLOT MACHINE</span><i className="bulbs" /></div>
          <div className="window">
            {spin.map((s, i) => <Reel key={i} index={i} spin={s} onStop={onStop} hot={hotCells[i]} />)}
            <svg className="lines" viewBox="0 0 5 3" preserveAspectRatio="none">
              {result?.wins.map(w => <polyline key={w.line} className="wl" vectorEffect="non-scaling-stroke"
                points={LINES[w.line].slice(0, w.count).map((r, i) => `${i + 0.5},${r + 0.5}`).join(' ')} />)}
            </svg>
          </div>
          <div className="bets" role="group" aria-label="Einsatz wählen">{BETS.map(b => <button key={b} className={'bet' + (b === bet ? ' on' : '')} disabled={busy || b > p.coins} onClick={() => setBet(b)}>{b}</button>)}</div>
          <div className="panel">
            <div className="lcd"><small>Guthaben</small><b>{p.coins}</b></div>
            <button className="spin-btn" onClick={() => { setPull(1); setTimeout(() => setPull(0), 180); doSpin() }} disabled={!canSpin}>
              {busy ? 'Walzen laufen' : `Drehen, ${bet} NC`}</button>
            <div className="lcd win"><small>Gewinn</small><b>{result ? result.total : 0}</b></div>
          </div>
          <div className="msg" role="status">
            {p.coins < BETS[0] && !busy ? (rescueReady ? <button className="btn sm" onClick={claimRescue}>Nachschub: {RESCUE} NC holen</button> : 'Zu wenig Coins. Hol dir morgen den Tagesbonus in der Lobby.')
              : result?.err ? result.err : result ? (result.tier === 'jackpot' ? 'JACKPOT!' : result.tier === 'big' ? 'Großer Gewinn!' : result.total ? 'Gewinn!' : 'Kein Gewinn, nochmal ziehen') : 'Zieh den Hebel oder tippe auf Drehen'}
          </div>
          <Tray burst={burst} />
        </div>
        <div className="lever" aria-label="Hebel" role="button" tabIndex={0} onKeyDown={keyLever}>
          <div className="base" />
          <div className="arm" style={{ height: 150 - pull * TRAVEL, transition: drag ? 'none' : 'height .5s cubic-bezier(.3,1.7,.5,1)' }} />
          <div className="knob" onPointerDown={down} onPointerMove={move} onPointerUp={up} onPointerCancel={up}
            style={{ transform: `translateY(${pull * TRAVEL}px)`, transition: drag ? 'none' : 'transform .5s cubic-bezier(.3,1.7,.5,1)' }} />
        </div>
      </div>
      <details className="paytable"><summary>Gewinntabelle für {bet} NC Einsatz (9 Linien, Auszahlung pro Linie in NC)</summary>
        <table><thead><tr><th>Symbol</th><th>3×</th><th>4×</th><th>5×</th></tr></thead><tbody>
          {Object.entries(PAYS).map(([s, v]) => <tr key={s}><td><Sym s={s} /></td>{v.map((x, i) => <td key={i}>{Math.round(x * bet / 2)}</td>)}</tr>)}
        </tbody></table>
        <p className="muted">Gleiche Symbole müssen auf einer Linie von links nach rechts liegen. Alle Ergebnisse sind zufällig und fair. Neon Coins haben keinen Echtgeldwert.</p>
      </details>
    </main>
  )
}
