import { useEffect, useRef, useState } from 'react'
import { useWallet } from '../context/Wallet.jsx'
import { rnd } from '../games/slotLogic.js'
import { sfx } from '../audio.js'
import BetBar from './BetBar.jsx'
import { useWin, tierOf } from './WinBanner.jsx'
const ORDER = [0,32,15,19,4,21,2,25,17,34,6,27,13,36,11,30,8,23,10,5,24,16,33,1,20,14,31,9,22,18,29,7,28,12,35,3,26]
const RED = new Set([1,3,5,7,9,12,14,16,18,19,21,23,25,27,30,32,34,36])
const colorOf = n => (n === 0 ? 'green' : RED.has(n) ? 'red' : 'black')
const OUT = [['red','Rot',n=>RED.has(n),2],['black','Schwarz',n=>n>0&&!RED.has(n),2],['even','Gerade',n=>n>0&&n%2===0,2],['odd','Ungerade',n=>n%2===1,2],
  ['low','1–18',n=>n>=1&&n<=18,2],['high','19–36',n=>n>=19,2],['d1','1. Dutzend',n=>n>=1&&n<=12,3],['d2','2. Dutzend',n=>n>=13&&n<=24,3],['d3','3. Dutzend',n=>n>=25,3],
  ['c1','Spalte 1',n=>n>0&&n%3===1,3],['c2','Spalte 2',n=>n>0&&n%3===2,3],['c3','Spalte 3',n=>n>0&&n%3===0,3]]
const mult = (k, n) => (k[0] === 'n' ? (+k.slice(1) === n ? 36 : 0) : OUT.find(o => o[0] === k)[3] * +OUT.find(o => o[0] === k)[2](n))
const A = 360 / 37
const pt = (deg, r) => [r * Math.sin(deg * Math.PI / 180), -r * Math.cos(deg * Math.PI / 180)]
export default function Roulette({ room, onBet, onDone }) {
  const { p, adjust, refresh, playRoulette } = useWallet()
  const showWin = useWin()
  const [chip, setChip] = useState(5), [bets, setBets] = useState({}), [last, setLast] = useState({})
  const [rot, setRot] = useState(0), [ball, setBall] = useState(0), [busy, setBusy] = useState(false), [res, setRes] = useState(null), [hist, setHist] = useState([])
  const total = Object.values(bets).reduce((a, b) => a + b, 0)
  const mine = !!room?.bets?.some(b => b.user_id === p.id), locked = !!room && (room.phase !== 'betting' || mine)
  const place = k => { if (busy || locked || total + chip > p.coins) return; sfx.chip(); setBets(b => ({ ...b, [k]: (b[k] || 0) + chip })) }
  const animate = (n, pay, stake, done) => {
    const idx = ORDER.indexOf(n)
    setBusy(true); setRes(null)
    setRot(r => r + 1800 + ((((-idx * A - r) % 360) + 360) % 360)); setBall(b => b - 1440)
    const tick = setInterval(sfx.tick, 110); setTimeout(() => clearInterval(tick), 4000)
    setTimeout(() => {
      if (pay) sfx.win(pay >= stake * 10 ? 'jackpot' : pay > stake ? 'big' : 'small'); else sfx.lose()
      if (stake && pay > stake) showWin(pay - stake, tierOf(pay - stake, stake))
      refresh(); setHist(h => [n, ...h].slice(0, 12)); setRes({ n, pay, stake }); setBets({}); setBusy(false); done?.()
    }, 5300)
  }
  const spin = async () => {
    if (busy || !total || total > p.coins) return
    sfx.unlock(); setBusy(true); setRes(null); setLast(bets)
    const stake = total, r = await playRoulette(bets)
    if (r.error) { setBusy(false); setRes({ err: r.error }); return }
    adjust(-stake); animate(r.n, Number(r.pay), stake)
  }
  const placeRoom = async () => {
    if (!total || locked || busy) return
    const r = await onBet(bets)
    if (r?.error) { setRes({ err: r.error }); return }
    adjust(-total); setBets({}); setRes(null)
  }
  // Mehrspieler: Ergebnis kommt aus dem Raum, alle Spieler lassen die Kugel gleichzeitig rollen
  const seen = useRef(null)
  useEffect(() => {
    if (!room) return
    if (room.phase === 'betting') seen.current = room.round
    else if (room.phase === 'result' && room.result != null) {
      if (seen.current === room.round) {
        seen.current = null
        const me = (room.payouts || []).find(x => x.user_id === p.id)
        animate(room.result, me ? Number(me.pay) : 0, me ? Number(me.stake) : 0, () => onDone?.(room.round))
      } else onDone?.(room.round)
    }
  }, [room?.phase, room?.round, room?.result])
  const Chip = ({ k }) => (bets[k] ? <i className="chipb">{bets[k]}</i> : null)
  return (
    <main className="table-page">
      <h1>Roulette</h1>
      <div className="felt roul">
        <div className="wheel-stage"><div className="wheel-box">
          <div className="pointer" />
          <svg viewBox="-112 -112 224 224" className="wheel" style={{ transform: `rotate(${rot}deg)`, transition: 'transform 5s cubic-bezier(.15,.6,.12,1)' }}>
            <defs><radialGradient id="wd" cx="40%" cy="35%" r="80%"><stop offset="0" stopColor="#a8642e"/><stop offset=".6" stopColor="#6b3516"/><stop offset="1" stopColor="#3b1c08"/></radialGradient>
              <linearGradient id="br" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stopColor="#fff3b0"/><stop offset=".5" stopColor="#d9a21f"/><stop offset="1" stopColor="#8a5d0a"/></linearGradient></defs>
            <circle r="111" fill="url(#wd)"/><circle r="105" fill="none" stroke="#e8c15a" strokeWidth="1.2"/><circle r="98" fill="#241008"/>
            {ORDER.map((n, i) => { const [x0, y0] = pt(i * A - A / 2, 96), [x1, y1] = pt(i * A + A / 2, 96), [tx, ty] = pt(i * A, 82)
              return <g key={n}><path d={`M0 0L${x0} ${y0}A96 96 0 0 1 ${x1} ${y1}Z`} className={'seg ' + colorOf(n)} />
                <text x={tx} y={ty} transform={`rotate(${i * A} ${tx} ${ty})`} className="num" textAnchor="middle" dominantBaseline="middle">{n}</text></g> })}
            <circle r="62" fill="url(#wd)" stroke="#e8c15a" strokeWidth="1.5" />{[0, 90].map(a => <g key={a} transform={`rotate(${a})`}><rect x="-30" y="-2.5" width="60" height="5" rx="2.5" fill="url(#br)" /><circle cx="-30" r="4.5" fill="url(#br)" /><circle cx="30" r="4.5" fill="url(#br)" /></g>)}<circle r="12" fill="url(#br)" /><circle r="5" fill="#fff6c8" />
          </svg>
          <div className="ball-orbit" style={{ transform: `rotate(${ball}deg)`, transition: 'transform 5s cubic-bezier(.2,.5,.1,1)' }}><i /></div>
        </div></div>
        <div className="hist">{hist.map((n, i) => <span key={i} className={'rn sm ' + colorOf(n)}>{n}</span>)}</div>
        <p className="msg-felt" role="status">{res?.err ? res.err : res ? `Zahl ${res.n}, ${{ red: 'Rot', black: 'Schwarz', green: 'Grün' }[colorOf(res.n)]}. ${res.pay > res.stake ? `Gewinn +${res.pay - res.stake} NC` : res.pay ? 'Einsatz teilweise zurück' : 'Kein Gewinn'}` : busy ? 'Kugel rollt …' : 'Setze Chips auf das Feld und drehe.'}</p>
        <div className="rboard">
          <button className="rn green zero" onClick={() => place('n0')}>0<Chip k="n0" /></button>
          <div className="rnums">{[3, 2, 1].flatMap(o => Array.from({ length: 12 }, (_, c) => c * 3 + o)).map(n =>
            <button key={n} className={'rn ' + colorOf(n)} onClick={() => place('n' + n)}>{n}<Chip k={'n' + n} /></button>)}</div>
        </div>
        <div className="outside">{OUT.map(o => <button key={o[0]} className="rout" onClick={() => place(o[0])}>{o[1]}<Chip k={o[0]} /></button>)}</div>
      </div>
      <BetBar bet={chip} setBet={setChip} disabled={busy} coins={p.coins} label="Chipwert" />
      <div className="row center">
        {room ? <button className="btn" onClick={placeRoom} disabled={busy || locked || !total || total > p.coins}>{mine ? 'Wetten abgegeben' : `Wetten abgeben, ${total} NC`}</button>
          : <button className="btn" onClick={spin} disabled={busy || !total || total > p.coins}>Drehen, {total} NC</button>}
        <button className="btn ghost" onClick={() => setBets({})} disabled={busy || !total}>Löschen</button>
        <button className="btn ghost" onClick={() => setBets(last)} disabled={busy || !Object.keys(last).length}>Letzte Wetten</button>
      </div>
      <p className="muted center-t">Zahl 36:1, Rot/Schwarz/Gerade/Ungerade/1–18/19–36 2:1, Dutzend und Spalte 3:1 (jeweils inklusive Einsatz). Die Null verliert alle Außenwetten.</p>
    </main>
  )
}
