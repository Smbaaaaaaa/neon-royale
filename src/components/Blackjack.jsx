import { useState } from 'react'
import { useWallet } from '../context/Wallet.jsx'
import { bjValue } from '../games/cards.js'
import { sfx } from '../audio.js'
import BetBar from './BetBar.jsx'
import { useWin, tierOf } from './WinBanner.jsx'
import Card from './Card.jsx'
import TableDice from './TableDice.jsx'
const sleep = ms => new Promise(r => setTimeout(r, ms))
export default function Blackjack() {
  const { p, adjust, refresh, call } = useWallet()
  const showWin = useWin()
  const [bet, setBet] = useState(10), [stake, setStake] = useState(0), [wait, setWait] = useState(false)
  const [g, setG] = useState({ phase: 'bet', player: [], dealer: [], msg: 'Wähle deinen Einsatz und teile aus.' })
  const fail = r => { setG(s => ({ ...s, msg: r.error })); setWait(false) }
  // Der Server liefert die fertige Runde, hier wird nur Karte für Karte aufgedeckt
  const finish = async r => {
    const d = r.dealer
    setG({ phase: 'dealer', player: r.player, dealer: d.slice(0, 2), msg: 'Dealer ist dran …' }); await sleep(700)
    for (let k = 3; k <= d.length; k++) { sfx.card(); setG(s => ({ ...s, dealer: d.slice(0, k) })); await sleep(750) }
    const pay = Number(r.pay), b0 = Number(r.bet)
    if (pay > b0) sfx.win(r.bj ? 'big' : 'small'); else if (pay) sfx.chip(); else sfx.lose()
    if (pay > b0) showWin(pay - b0, tierOf(pay - b0, b0))
    setG({ phase: 'done', player: r.player, dealer: d, msg: r.msg + (pay > b0 ? ` +${pay - b0} NC` : '') })
    refresh(); setWait(false)
  }
  const show = r => { sfx.card(); setG({ phase: 'play', player: r.player, dealer: r.dealer, msg: 'Karte, bleiben oder verdoppeln?' }); setWait(false) }
  const deal = async () => {
    if (wait || p.coins < bet) return
    sfx.unlock(); sfx.chip(); setWait(true)
    const r = await call('bj_deal', { p_bet: bet }); if (r.error) return fail(r)
    adjust(-bet); setStake(bet); r.done ? finish(r) : show(r)
  }
  const hit = async () => { if (wait) return; setWait(true); const r = await call('bj_hit'); if (r.error) return fail(r); r.done ? finish(r) : show(r) }
  const stand = async () => { if (wait) return; setWait(true); const r = await call('bj_stand'); if (r.error) return fail(r); finish(r) }
  const dbl = async () => { if (wait) return; setWait(true); const r = await call('bj_double'); if (r.error) return fail(r); adjust(-stake); setStake(stake * 2); finish(r) }
  const idle = g.phase === 'bet' || g.phase === 'done', playing = g.phase === 'play'
  return (
    <main className="table-page">
      <h1>Blackjack</h1>
      <div className="felt">
        <TableDice />
        <div className="hand"><small>Dealer {!playing && g.dealer.length ? bjValue(g.dealer) : ''}</small>
          <div className="cards">{g.dealer.map((c, i) => <Card key={i + '' + c.r + c.s} c={c} i={i} hidden={playing && i === 1} />)}</div></div>
        <p className="msg-felt" role="status">{g.msg}</p>
        <div className="hand"><small>{p.name} {g.player.length ? bjValue(g.player) : ''}</small>
          <div className="cards">{g.player.map((c, i) => <Card key={i + '' + c.r + c.s} c={c} i={i} />)}</div></div>
      </div>
      <BetBar bet={bet} setBet={setBet} disabled={!idle || wait} coins={p.coins} />
      <div className="row center">
        {idle && <button className="btn" onClick={deal} disabled={wait || p.coins < bet}>{g.phase === 'done' ? 'Neue Runde' : 'Austeilen'}, {bet} NC</button>}
        {playing && <><button className="btn" onClick={hit} disabled={wait}>Karte</button><button className="btn ghost" onClick={stand} disabled={wait}>Bleiben</button>
          <button className="btn ghost" onClick={dbl} disabled={wait || p.coins < stake || g.player.length !== 2}>Verdoppeln</button></>}
      </div>
      <p className="muted center-t">Dealer zieht bis 17. Blackjack zahlt 3:2. Karten und Auszahlung kommen vom Server. Split und Versicherung gibt es noch nicht.</p>
    </main>
  )
}
