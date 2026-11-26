import { useState } from 'react'
import { useWallet } from '../context/Wallet.jsx'
import { sfx } from '../audio.js'
import BetBar from './BetBar.jsx'
import TableDice, { Die } from './TableDice.jsx'
import { useWin, tierOf } from './WinBanner.jsx'
const FIELDS = [['low', 'Niedrig 2 bis 6', '×2,3'], ['seven', 'Sieben', '×5,8'], ['high', 'Hoch 8 bis 12', '×2,3'], ['double', 'Pasch', '×5,8'], ['even', 'Gerade Summe', '×1,92'], ['odd', 'Ungerade Summe', '×1,92']]
const fmt = n => Number(n).toLocaleString('de-DE')
export default function DiceGame() {
  const { p, adjust, refresh, call } = useWallet(), showWin = useWin()
  const [chip, setChip] = useState(10), [bets, setBets] = useState({}), [last, setLast] = useState({}), [busy, setBusy] = useState(false)
  const [rolling, setRolling] = useState(false), [vals, setVals] = useState([3, 4]), [res, setRes] = useState(null), [err, setErr] = useState('')
  const total = Object.values(bets).reduce((a, b) => a + b, 0)
  const place = k => { if (busy || total + chip > p.coins) return; sfx.chip(); setBets(b => ({ ...b, [k]: (b[k] || 0) + chip })) }
  const roll = async () => {
    if (busy || total < 2 || total > p.coins) return
    sfx.unlock(); setBusy(true); setErr(''); setRes(null); setLast(bets); setRolling(true)
    const stake = total, t0 = Date.now(), r = await call('play_dice', { p_bets: bets })
    if (r?.error) { setBusy(false); setRolling(false); setErr(r.error); return }
    adjust(-stake); const tick = setInterval(sfx.tick, 110)
    setTimeout(() => {
      clearInterval(tick); const pay = Number(r.pay)
      setRolling(false); setVals([r.d1, r.d2]); setRes(r); setBets({}); refresh()
      if (pay > 0) sfx.win(pay >= stake * 4 ? 'jackpot' : pay > stake ? 'big' : 'small'); else sfx.lose()
      if (pay > stake) showWin(pay - stake, tierOf(pay - stake, stake)); setBusy(false)
    }, Math.max(300, 1700 - (Date.now() - t0)))
  }
  const Chip = ({ k }) => (bets[k] ? <i className="chipb">{fmt(bets[k])}</i> : null)
  return (
    <main className="table-page"><h1>Würfeltisch</h1>
      <div className="rail"><div className="felt dicetable">
        <TableDice />
        <div className="bigdice"><Die n={vals[0]} roll={rolling} /><Die n={vals[1]} roll={rolling} /></div>
        <p className="msg-felt" role="status">{err || (res ? `Summe ${res.d1 + res.d2} (${res.d1} und ${res.d2}). ${Number(res.pay) > Number(res.stake) ? `Gewinn +${fmt(res.pay - res.stake)} RC` : Number(res.pay) > 0 ? 'Einsatz teilweise zurück' : 'Kein Gewinn'}` : rolling ? 'Die Würfel rollen …' : 'Setze Chips auf ein Feld und würfle.')}</p>
        <div className="dfields">{FIELDS.map(([k, label, m]) => <button key={k} className="rout dfield" onClick={() => place(k)}><b>{label}</b><small>{m}</small><Chip k={k} /></button>)}</div>
      </div></div>
      <BetBar bet={chip} setBet={setChip} disabled={busy} coins={p.coins} label="Chipwert" />
      <div className="row center">
        <button className="btn" onClick={roll} disabled={busy || total < 2 || total > p.coins}>Würfeln, {fmt(total)} RC</button>
        <button className="btn ghost" onClick={() => setBets({})} disabled={busy || !total}>Löschen</button>
        <button className="btn ghost" onClick={() => setBets(last)} disabled={busy || !Object.keys(last).length}>Letzte Wetten</button></div>
      <p className="muted center-t">Zwei Würfel werden auf dem Server gewürfelt. Mehrere Wetten sind gleichzeitig möglich. Gewinn inklusive Einsatz, Quote etwa 96 %.</p>
    </main>
  )
}
