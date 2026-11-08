import { useEffect, useRef, useState } from 'react'
import { useWallet } from '../context/Wallet.jsx'
import { sfx } from '../audio.js'
import BetBar from './BetBar.jsx'
import Card from './Card.jsx'
import TableDice from './TableDice.jsx'
import { useWin, tierOf } from './WinBanner.jsx'
const NAMES = ['Hohe Karte', 'Ein Paar', 'Zwei Paare', 'Drilling', 'Straße', 'Flush', 'Full House', 'Vierling', 'Straight Flush']
const NONE = [false, false, false, false, false]
export default function PokerRoom({ room, act, busy }) {
  const { p, refresh } = useWallet(); const showWin = useWin()
  const [ante, setAnte] = useState(10), [held, setHeld] = useState(NONE), shown = useRef(null)
  const host = room.host === p.id, mh = room.my_hand
  useEffect(() => { setHeld(NONE) }, [room.round])
  useEffect(() => { if (room.phase === 'draw') { refresh(); sfx.card() } }, [room.phase, room.round])
  useEffect(() => {
    if (room.phase !== 'showdown' || shown.current === room.round) return
    shown.current = room.round; refresh()
    const me = room.payouts.find(x => x.user_id === p.id)
    if (me && Number(me.pay) > Number(me.stake)) {
      const net = Number(me.pay) - Number(me.stake); sfx.win('big'); showWin(net, tierOf(net, Number(me.stake)))
    } else sfx.lose()
  }, [room.phase, room.round])
  const toggle = i => room.phase === 'draw' && mh && !mh.done && (sfx.chip(), setHeld(h => h.map((x, k) => (k === i ? !x : x))))
  return (
    <div>
      <div className="rail"><div className="felt">
        <TableDice />
        <p className="msg-felt" role="status">
          {room.phase === 'lobby' && 'Wartet auf den Start der Runde.'}
          {room.phase === 'draw' && `Pot: ${room.pot} NC (Einsatz ${room.ante} NC pro Spieler)`}
          {room.phase === 'showdown' && `Showdown. Pot: ${room.pot} NC`}
        </p>
        {room.phase === 'draw' && <>
          <div className="members">{room.seats.map(s => <span key={s.user_id} className={'member' + (s.done ? ' ok' : '')}>{s.name}{s.done ? ' hat getauscht ✓' : ' denkt nach …'}</span>)}</div>
          {mh ? <>
            <div className="cards">{mh.hand.map((c, i) => <Card key={i + '' + c.r + c.s} c={c} i={i} hold={held[i] && !mh.done} onClick={() => toggle(i)} />)}</div>
            <p className="msg-felt">{mh.done ? 'Warte auf die anderen Spieler …' : 'Tippe auf Karten, die du behalten willst. Der Rest wird getauscht.'}</p>
          </> : <p className="msg-felt">Du bist in dieser Runde nicht dabei. Beim nächsten Start kannst du mitspielen.</p>}
        </>}
        {room.phase === 'showdown' && room.payouts.map(x => (
          <div key={x.user_id} className="hand"><small>{x.name}: {NAMES[x.cat]} {x.win ? `, gewinnt ${x.pay} NC 🏆` : ''}</small>
            <div className="cards">{x.hand.map((c, i) => <Card key={i + '' + c.r + c.s} c={c} i={i} hold={x.win} />)}</div></div>))}
      </div></div>
      <div className="row center">
        {room.phase === 'lobby' && host && <>
          <BetBar bet={ante} setBet={setAnte} coins={p.coins} label="Einsatz pro Spieler" />
          <button className="btn" disabled={busy || room.members.length < 2} onClick={() => act('poker_start', { p_ante: ante })}>Runde starten, {ante} NC</button></>}
        {room.phase === 'draw' && mh && !mh.done && <button className="btn" disabled={busy} onClick={() => act('poker_exchange', { p_held: held })}>Karten tauschen</button>}
        {room.phase === 'draw' && host && <button className="btn ghost" disabled={busy} onClick={() => act('poker_force')}>Runde erzwingen</button>}
        {room.phase === 'showdown' && host && <button className="btn" disabled={busy} onClick={() => act('poker_next')}>Nächste Runde</button>}
      </div>
      <p className="muted center-t">{room.phase === 'lobby' ? (host ? (room.members.length < 2 ? 'Du brauchst mindestens einen Mitspieler. Schick ihm den Raumcode.' : 'Wähle den Einsatz und starte die Runde.') : 'Der Gastgeber startet die Runde.') : 'Five Card Draw: Jeder bekommt 5 Karten und tauscht einmal. Die beste Hand gewinnt den Pot.'}</p>
    </div>
  )
}
