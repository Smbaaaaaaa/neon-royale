import { useState } from 'react'
import { useWallet } from '../context/Wallet.jsx'
import { POKER } from '../games/cards.js'
import { sfx } from '../audio.js'
import BetBar from './BetBar.jsx'
import { useWin, tierOf } from './WinBanner.jsx'
import Card from './Card.jsx'
import TableDice from './TableDice.jsx'
export default function VideoPoker() {
  const { p, adjust, refresh, call } = useWallet()
  const showWin = useWin()
  const [bet, setBet] = useState(10), [wait, setWait] = useState(false), [err, setErr] = useState('')
  const [s, setS] = useState({ phase: 'bet', hand: [], held: [false, false, false, false, false], win: null, pay: 0, stake: 0 })
  const deal = async () => {
    if (wait || p.coins < bet) return
    sfx.unlock(); sfx.chip(); setWait(true); setErr('')
    const r = await call('poker_deal', { p_bet: bet })
    setWait(false); if (r.error) return setErr(r.error)
    adjust(-bet); sfx.card(); setS({ phase: 'hold', hand: r.hand, held: [false, false, false, false, false], win: null, pay: 0, stake: bet })
  }
  const draw = async () => {
    if (wait) return
    setWait(true); setErr('')
    const r = await call('poker_draw', { p_held: s.held })
    setWait(false); if (r.error) return setErr(r.error)
    const pay = Number(r.pay); sfx.card()
    if (pay) sfx.win(pay >= s.stake * 25 ? 'jackpot' : pay >= s.stake * 6 ? 'big' : 'small'); else sfx.lose()
    if (pay > s.stake) showWin(pay - s.stake, tierOf(pay - s.stake, s.stake))
    refresh(); setS({ ...s, phase: 'done', hand: r.hand, win: r.win, pay })
  }
  const toggle = i => s.phase === 'hold' && (sfx.chip(), setS({ ...s, held: s.held.map((h, k) => (k === i ? !h : h)) }))
  const idle = s.phase !== 'hold'
  return (
    <main className="table-page">
      <h1>Video Poker</h1>
      <div className="felt">
        <TableDice />
        <div className="cards">{s.hand.length ? s.hand.map((c, i) => <Card key={i + '' + c.r + c.s} c={c} i={s.phase === 'hold' ? i : 0} hold={s.held[i] && s.phase === 'hold'} onClick={() => toggle(i)} />)
          : Array.from({ length: 5 }, (_, i) => <Card key={i} hidden />)}</div>
        <p className="msg-felt" role="status">{err || (s.phase === 'bet' ? 'Wähle deinen Einsatz und teile aus.' : s.phase === 'hold' ? 'Tippe auf Karten, die du behalten willst.'
          : s.win ? `${POKER.find(r => r[0] === s.win)[1]}! +${s.pay - s.stake} NC` : 'Kein Gewinn.')}</p>
      </div>
      <BetBar bet={bet} setBet={setBet} disabled={!idle || wait} coins={p.coins} />
      <div className="row center">
        {idle ? <button className="btn" onClick={deal} disabled={wait || p.coins < bet}>Austeilen, {bet} NC</button> : <button className="btn" onClick={draw} disabled={wait}>Ziehen</button>}
      </div>
      <details className="paytable" open><summary>Gewinntabelle bei {bet} NC Einsatz</summary>
        <table><tbody>{POKER.map(([k, n, m]) => <tr key={k} className={s.win === k ? 'cur' : ''}><td>{n}</td><td>{m * bet} NC</td></tr>)}</tbody></table></details>
    </main>
  )
}
