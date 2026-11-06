import { useState } from 'react'
import { useWallet } from '../context/Wallet.jsx'
import { newDeck, pokerEval, POKER } from '../games/cards.js'
import { sfx } from '../audio.js'
import BetBar from './BetBar.jsx'
import { useWin, tierOf } from './WinBanner.jsx'
import Card from './Card.jsx'
export default function VideoPoker() {
  const { p, spend, earn, addStat } = useWallet()
  const showWin = useWin()
  const [bet, setBet] = useState(10), [s, setS] = useState({ phase: 'bet', hand: [], held: [], deck: [], win: null, stake: 0 })
  const deal = () => {
    if (p.coins < bet) return
    sfx.unlock(); sfx.chip(); spend(bet)
    const deck = newDeck(1), hand = deck.splice(0, 5)
    sfx.card(); setS({ phase: 'hold', hand, held: [false, false, false, false, false], deck, win: null, stake: bet })
  }
  const draw = () => {
    const deck = [...s.deck], hand = s.hand.map((c, i) => (s.held[i] ? c : deck.pop()))
    sfx.card()
    const key = pokerEval(hand), row = POKER.find(r => r[0] === key), pay = row ? row[2] * s.stake : 0
    if (pay) { earn(pay); sfx.win(row[2] >= 25 ? 'jackpot' : row[2] >= 6 ? 'big' : 'small') } else sfx.lose()
    addStat('poker', s.stake, pay); if (pay > s.stake) showWin(pay - s.stake, tierOf(pay - s.stake, s.stake))
    setS({ ...s, phase: 'done', hand, deck, win: key, pay })
  }
  const toggle = i => s.phase === 'hold' && (sfx.chip(), setS({ ...s, held: s.held.map((h, k) => (k === i ? !h : h)) }))
  const idle = s.phase !== 'hold'
  return (
    <main className="table-page">
      <h1>Video Poker</h1>
      <div className="felt">
        <div className="cards">{s.hand.length ? s.hand.map((c, i) => <Card key={i + '' + c.r + c.s} c={c} i={s.phase === 'hold' ? i : 0} hold={s.held[i] && s.phase === 'hold'} onClick={() => toggle(i)} />)
          : Array.from({ length: 5 }, (_, i) => <Card key={i} hidden />)}</div>
        <p className="msg-felt" role="status">{s.phase === 'bet' ? 'Wähle deinen Einsatz und teile aus.' : s.phase === 'hold' ? 'Tippe auf Karten, die du behalten willst.'
          : s.win ? `${POKER.find(r => r[0] === s.win)[1]}! +${s.pay - s.stake} NC` : 'Kein Gewinn.'}</p>
      </div>
      <BetBar bet={bet} setBet={setBet} disabled={!idle} coins={p.coins} />
      <div className="row center">
        {idle ? <button className="btn" onClick={deal} disabled={p.coins < bet}>Austeilen, {bet} NC</button> : <button className="btn" onClick={draw}>Ziehen</button>}
      </div>
      <details className="paytable" open><summary>Gewinntabelle bei {bet} NC Einsatz</summary>
        <table><tbody>{POKER.map(([k, n, m]) => <tr key={k} className={s.win === k ? 'cur' : ''}><td>{n}</td><td>{m * bet} NC</td></tr>)}</tbody></table></details>
    </main>
  )
}
