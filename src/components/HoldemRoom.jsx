import { Fragment, useEffect, useRef, useState } from 'react'
import { useWallet } from '../context/Wallet.jsx'
import { sfx } from '../audio.js'
import { SUITS, rankLabel } from '../games/cards.js'
import Card from './Card.jsx'
import Avatar from './Avatar.jsx'
import NameFx from './NameFx.jsx'
import TableDice from './TableDice.jsx'
import { useWin, tierOf } from './WinBanner.jsx'
const HANDS = ['Hohe Karte', 'Ein Paar', 'Zwei Paare', 'Drilling', 'Straße', 'Flush', 'Full House', 'Vierling', 'Straight Flush']
const BBS = [10, 20, 50, 100, 200, 500, 1000]
const fmt = n => Number(n).toLocaleString('de-DE')
// Kleine Karte am Sitzplatz: verdeckt oder offen
const MC = ({ c, big, cb }) => !c
  ? <div className={'mc back' + (big ? ' big' : '') + (cb ? ' cb-' + cb : '')} />
  : <div className={'mc' + (c.s === 1 || c.s === 2 ? ' red' : '') + (big ? ' big' : '')}><b>{rankLabel(c.r)}</b><span>{SUITS[c.s]}</span></div>
// Position auf der Ellipse: Index 0 (du) sitzt unten, die anderen folgen im Uhrzeigersinn
const pos = (i, n, r = 1) => {
  const th = Math.PI / 2 + (i * 2 * Math.PI) / n
  return { left: 50 + 43 * r * Math.cos(th) + '%', top: 50 + 40 * r * Math.sin(th) + '%' }
}
export default function HoldemRoom({ room, act, busy }) {
  const { p, refresh } = useWallet(); const showWin = useWin()
  const seats = room.hseats || [], me = seats.find(s => s.user_id === p.id), host = room.host === p.id
  const bb = Number(room.bb), minBuy = bb * 20, maxBuy = bb * 200, board = room.board || [], payouts = room.payouts || []
  const [buy, setBuy] = useState(minBuy * 2), [amt, setAmt] = useState(0), shown = useRef(null)
  const myTurn = room.phase === 'hand' && room.cur === p.id && !!me
  const toCall = me ? Math.max(0, Number(room.cbet) - Number(me.bet)) : 0
  const maxTo = me ? Number(me.bet) + Number(me.stack) : 0
  const minTo = Math.min(maxTo, Number(room.cbet) + Math.max(Number(room.minraise), bb))
  const canRaise = myTurn && maxTo > Number(room.cbet)
  const pot = Number(room.pot), live = room.phase === 'hand' || room.phase === 'showdown', myCards = room.my_hand?.hand
  const myIdx = Math.max(0, seats.findIndex(s => s.user_id === p.id))
  const order = [...seats.slice(myIdx), ...seats.slice(0, myIdx)]
  useEffect(() => { setBuy(Math.min(maxBuy, minBuy * 2)) }, [bb])
  useEffect(() => { setAmt(minTo) }, [room.round, room.street, room.cbet, room.cur])
  useEffect(() => { refresh() }, [room.phase, room.round])
  useEffect(() => { if (board.length) sfx.card() }, [board.length])
  useEffect(() => {
    if (room.phase !== 'showdown' || shown.current === room.round) return
    shown.current = room.round
    const mine = payouts.find(x => x.user_id === p.id)
    if (mine && Number(mine.won) > Number(mine.stake)) {
      const net = Number(mine.won) - Number(mine.stake); sfx.win(net >= bb * 20 ? 'jackpot' : 'big'); showWin(net, tierOf(net, Math.max(Number(mine.stake), 1)))
    }
  }, [room.phase, room.round])
  const go = async (fn, extra) => { sfx.chip(); await act(fn, extra); refresh() }
  const clamp = v => Math.min(maxTo, Math.max(minTo, Math.round(Number(v) || 0)))
  const frac = f => setAmt(clamp(Number(me.bet) + toCall + Math.round(pot * f)))
  return (
    <div>
      <div className="ptable">
        <TableDice />
        <div className="prail" />
        <div className="pfelt" />
        <div className="pcenter">
          <div className="pot">Pot: <b>{fmt(pot)} RC</b> · Blinds {fmt(bb / 2)}/{fmt(bb)}{room.phase === 'hand' ? ` · ${{ preflop: 'Preflop', flop: 'Flop', turn: 'Turn', river: 'River' }[room.street]}` : ''}</div>
          <div className="cards board">{Array.from({ length: 5 }, (_, i) => board[i]
            ? <Card key={i + '' + board[i].r + board[i].s} c={board[i]} i={i} /> : <Card key={'e' + i} hidden />)}</div>
          {!seats.length && <p className="msg-felt">Noch niemand sitzt am Tisch.</p>}
        </div>
        {order.map((s, i) => {
          const mine = s.user_id === p.id, pay = payouts.find(x => x.user_id === s.user_id)
          const faceUp = mine ? myCards : (room.phase === 'showdown' ? pay?.hole : null)
          const cards = live && s.in_hand ? (faceUp || (!s.folded ? [null, null] : null)) : null
          const won = pay && Number(pay.won) > 0
          return (
            <Fragment key={s.user_id}>
              {Number(s.bet) > 0 && <div className={'pbet anim-' + (s.eq?.anim || 'classic-flip')} style={pos(i, order.length, 0.58)}><i />{fmt(s.bet)}</div>}
              <div className={'pseat anim-' + (s.eq?.anim || 'classic-flip') + (room.cur === s.user_id && room.phase === 'hand' ? ' turn' : '') + (s.folded && s.in_hand ? ' fold' : '') + (mine ? ' me' : '') + (won ? ' win' : '')}
                style={pos(i, order.length)}>
                {cards && <div className="pcards">{cards.map((c, k) => <MC key={k + (faceUp ? 'u' : 'd')} c={faceUp ? c : null} big={mine} cb={s.eq?.cardback} />)}</div>}
                <div className="pname"><NameFx name={s.name} fx={s.eq?.namefx} />{room.btn === s.seat && <span className="dbtn">D</span>}</div>
                <Avatar size={30} frame={s.eq?.frame || 'silverline'} avatar={s.eq?.avatar || 'ace-of-spades'} />
                <div className="pstack">{fmt(s.stack)}{s.allin && s.in_hand ? ' · All-in' : ''}</div>
                {won && <div className="pwin">+{fmt(pay.won)}</div>}
                {pay?.hole && !pay.folded && <div className="phand">{HANDS[pay.cat]}</div>}
              </div>
            </Fragment>
          )
        })}
      </div>
      <div className="hlog">{(room.log || []).slice(-4).map((l, i) => <div key={i}>{l}</div>)}</div>

      {myTurn && <div className="actions">
        <button className="btn ghost" disabled={busy} onClick={() => go('holdem_act', { p_action: 'fold' })}>Passen</button>
        {toCall === 0 ? <button className="btn" disabled={busy} onClick={() => go('holdem_act', { p_action: 'check' })}>Checken</button>
          : <button className="btn" disabled={busy} onClick={() => go('holdem_act', { p_action: 'call' })}>{toCall >= Number(me.stack) ? `All-in ${fmt(me.stack)}` : `Mitgehen ${fmt(toCall)}`}</button>}
        {canRaise && <div className="raise">
          <div className="row center"><button className="btn sm ghost" onClick={() => setAmt(minTo)}>Min</button><button className="btn sm ghost" onClick={() => frac(0.5)}>½ Pot</button>
            <button className="btn sm ghost" onClick={() => frac(1)}>Pot</button><button className="btn sm ghost" onClick={() => setAmt(maxTo)}>All-in</button></div>
          <input type="range" min={minTo} max={maxTo} step={Math.max(1, Math.floor(bb / 2))} value={clamp(amt)} onChange={e => setAmt(+e.target.value)} aria-label="Erhöhung" />
          <div className="row center"><input type="number" min={minTo} max={maxTo} value={amt} onChange={e => setAmt(e.target.value)} style={{ width: '9rem' }} aria-label="Betrag" />
            <button className="btn" disabled={busy} onClick={() => go('holdem_act', { p_action: clamp(amt) >= maxTo ? 'allin' : 'raise', p_amount: clamp(amt) })}>
              {clamp(amt) >= maxTo ? `All-in ${fmt(maxTo)}` : `Erhöhen auf ${fmt(clamp(amt))}`}</button></div></div>}
      </div>}
      {room.phase === 'hand' && !myTurn && <p className="muted center-t">{room.cur ? `${seats.find(s => s.user_id === room.cur)?.name || 'Jemand'} ist dran …` : 'Die Hand läuft …'}</p>}
      {host && room.phase === 'hand' && room.cur && room.cur !== p.id && <div className="row center"><button className="btn sm ghost" disabled={busy} onClick={() => go('holdem_skip')}>Spieler überspringen</button></div>}

      {(room.phase === 'lobby' || room.phase === 'showdown') && <div className="tile seatpanel">
        <h2>{me ? `Dein Stack: ${fmt(me.stack)} RC` : 'Setz dich an den Tisch'}</h2>
        <p className="muted">Buy-in von {fmt(minBuy)} bis {fmt(maxBuy)} RC (20 bis 200 Big Blinds). Was du nicht verspielst, bekommst du beim Aufstehen zurück.</p>
        <div className="row center"><input type="range" min={minBuy} max={maxBuy} step={bb} value={buy} onChange={e => setBuy(+e.target.value)} aria-label="Buy-in" />
          <b>{fmt(buy)} RC</b></div>
        <div className="row center">
          <button className="btn" disabled={busy || buy > p.coins} onClick={() => go('holdem_sit', { p_buyin: buy })}>{me ? 'Chips nachkaufen' : 'Hinsetzen'}{buy > p.coins ? ' (zu wenig RC)' : ''}</button>
          {me && <button className="btn ghost" disabled={busy} onClick={() => go('holdem_standup')}>Aufstehen und auszahlen</button>}</div>
        {host && <div className="row center">
          {room.phase === 'lobby' && !seats.length && <label className="muted">Big Blind: <select value={bb} onChange={e => go('holdem_blinds', { p_bb: +e.target.value })}>{BBS.map(b => <option key={b} value={b}>{b}</option>)}</select></label>}
          <button className="btn" disabled={busy || seats.filter(s => Number(s.stack) > 0).length < 2} onClick={() => go('holdem_deal')}>{room.phase === 'lobby' ? 'Hand starten' : 'Nächste Hand'}</button></div>}
        {!host && <p className="muted center-t">Der Gastgeber teilt die Hand aus.</p>}
      </div>}
    </div>
  )
}
