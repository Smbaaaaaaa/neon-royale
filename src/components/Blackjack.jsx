import { useRef, useState } from 'react'
import { useWallet } from '../context/Wallet.jsx'
import { newDeck, bjValue } from '../games/cards.js'
import { sfx } from '../audio.js'
import BetBar from './BetBar.jsx'
import { useWin, tierOf } from './WinBanner.jsx'
import Card from './Card.jsx'
const sleep = ms => new Promise(r => setTimeout(r, ms))
export default function Blackjack() {
  const { p, spend, earn, addStat } = useWallet()
  const showWin = useWin()
  const [bet, setBet] = useState(10), [stake, setStake] = useState(0)
  const [g, setG] = useState({ phase: 'bet', player: [], dealer: [], msg: 'Wähle deinen Einsatz und teile aus.' })
  const shoe = useRef([])
  const draw = () => { if (shoe.current.length < 60) shoe.current = newDeck(6); sfx.card(); return shoe.current.pop() }
  const settle = (player, dealer, stk) => {
    const pv = bjValue(player), dv = bjValue(dealer), bj = player.length === 2 && pv === 21
    let pay = 0, msg
    if (pv > 21) msg = 'Bust. Du hast über 21.'
    else if (bj && !(dealer.length === 2 && dv === 21)) { pay = Math.floor(stk * 2.5); msg = 'Blackjack! Auszahlung 3:2.' }
    else if (dv > 21) { pay = stk * 2; msg = 'Dealer Bust. Du gewinnst!' }
    else if (pv > dv) { pay = stk * 2; msg = 'Du gewinnst!' }
    else if (pv === dv) { pay = stk; msg = 'Unentschieden, Einsatz zurück.' }
    else msg = 'Dealer gewinnt.'
    if (pay) earn(pay); pay > stk ? sfx.win(bj ? 'big' : 'small') : pay ? sfx.chip() : sfx.lose()
    addStat('blackjack', stk, pay); if (pay > stk) showWin(pay - stk, tierOf(pay - stk, stk))
    setG({ phase: 'done', player, dealer, msg: msg + (pay > stk ? ` +${pay - stk} NC` : '') })
  }
  const stand = async (player, dealer, stk) => {
    setG({ phase: 'dealer', player, dealer, msg: 'Dealer ist dran …' }); await sleep(700)
    while (bjValue(dealer) < 17) { dealer = [...dealer, draw()]; setG(s => ({ ...s, dealer })); await sleep(750) }
    settle(player, dealer, stk)
  }
  const deal = () => {
    if (p.coins < bet) return
    sfx.unlock(); sfx.chip(); spend(bet); setStake(bet)
    const player = [draw(), draw()], dealer = [draw(), draw()]
    if (bjValue(player) === 21) settle(player, dealer, bet)
    else setG({ phase: 'play', player, dealer, msg: 'Karte, bleiben oder verdoppeln?' })
  }
  const hit = () => {
    const player = [...g.player, draw()], v = bjValue(player)
    if (v > 21) settle(player, g.dealer, stake); else if (v === 21) stand(player, g.dealer, stake); else setG({ ...g, player })
  }
  const dbl = () => {
    if (p.coins < stake) return
    spend(stake); sfx.chip(); const stk = stake * 2; setStake(stk)
    const player = [...g.player, draw()]
    bjValue(player) > 21 ? settle(player, g.dealer, stk) : stand(player, g.dealer, stk)
  }
  const idle = g.phase === 'bet' || g.phase === 'done', playing = g.phase === 'play'
  return (
    <main className="table-page">
      <h1>Blackjack</h1>
      <div className="felt">
        <div className="hand"><small>Dealer {!playing && g.dealer.length ? bjValue(g.dealer) : ''}</small>
          <div className="cards">{g.dealer.map((c, i) => <Card key={i + '' + c.r + c.s} c={c} i={i} hidden={playing && i === 1} />)}</div></div>
        <p className="msg-felt" role="status">{g.msg}</p>
        <div className="hand"><small>{p.name} {g.player.length ? bjValue(g.player) : ''}</small>
          <div className="cards">{g.player.map((c, i) => <Card key={i + '' + c.r + c.s} c={c} i={i} />)}</div></div>
      </div>
      <BetBar bet={bet} setBet={setBet} disabled={!idle} coins={p.coins} />
      <div className="row center">
        {idle && <button className="btn" onClick={deal} disabled={p.coins < bet}>{g.phase === 'done' ? 'Neue Runde' : 'Austeilen'}, {bet} NC</button>}
        {playing && <><button className="btn" onClick={hit}>Karte</button><button className="btn ghost" onClick={() => stand(g.player, g.dealer, stake)}>Bleiben</button>
          <button className="btn ghost" onClick={dbl} disabled={p.coins < stake || g.player.length !== 2}>Verdoppeln</button></>}
      </div>
      <p className="muted center-t">Dealer zieht bis 17. Blackjack zahlt 3:2. Split und Versicherung gibt es noch nicht.</p>
    </main>
  )
}
