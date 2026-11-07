import { useCallback, useEffect, useState } from 'react'
import { supabase } from '../supabase.js'
import { useWallet } from '../context/Wallet.jsx'
import Roulette from './Roulette.jsx'
import PokerRoom from './PokerRoom.jsx'
import HoldemRoom from './HoldemRoom.jsx'
export default function Multiplayer() {
  const { p, call } = useWallet()
  const [code, setCode] = useState(() => localStorage.getItem('nr-room') || ''), [input, setInput] = useState('')
  const [room, setRoom] = useState(null), [err, setErr] = useState(''), [revealed, setRevealed] = useState(0), [wait, setWait] = useState(false)
  const enter = c => { localStorage.setItem('nr-room', c); setCode(c); setErr('') }
  const exit = () => { localStorage.removeItem('nr-room'); setCode(''); setRoom(null); setRevealed(0) }
  const load = useCallback(async c => {
    const r = await call('get_room', { p_code: c })
    if (r?.error) { setErr(r.error); exit(); return }
    setRoom(r)
  }, [call])
  useEffect(() => {
    if (!code) return
    load(code)
    const ch = supabase.channel('room-' + code)
    for (const table of ['rooms', 'room_members', 'room_bets', 'holdem_seats'])
      ch.on('postgres_changes', { event: '*', schema: 'public', table, filter: `code=eq.${code}` }, () => load(code))
    ch.subscribe()
    const poll = setInterval(() => load(code), 4000) // Sicherheitsnetz, falls Echtzeit mal ausfällt
    return () => { clearInterval(poll); supabase.removeChannel(ch) }
  }, [code, load])
  const create = async game => { setWait(true); const r = await call('create_room', { p_game: game }); setWait(false); r?.error ? setErr(r.error) : enter(r) }
  const join = async () => { setWait(true); const r = await call('join_room', { p_code: input }); setWait(false); r?.error ? setErr(r.error) : enter(r) }
  const leave = async () => { await call('leave_room', { p_code: code }); exit() }
  const act = async (fn, extra = {}) => {
    setWait(true); const r = await call(fn, { p_code: code, ...extra }); setWait(false)
    if (r?.error) setErr(r.error); else { setErr(''); load(code) }
    return r
  }

  if (!code || !room) return (
    <main><h1>Multiplayer</h1>
      <p className="muted">Spiele mit Freunden in privaten Räumen. Der Gastgeber erstellt einen Raum und bekommt einen 5-stelligen Code. Deine Freunde geben ihn bei "Raum beitreten" ein.</p>
      <div className="grid">
        <section className="tile"><h2>Roulette-Raum</h2><p>Alle setzen auf denselben Tisch, der Gastgeber dreht, bis zu 8 Spieler.</p><button className="btn" onClick={() => create('roulette')} disabled={wait}>Roulette-Raum erstellen</button></section>
        <section className="tile"><h2>Poker-Raum</h2><p>Five Card Draw gegeneinander um einen gemeinsamen Pot, 2 bis 5 Spieler.</p><button className="btn" onClick={() => create('poker')} disabled={wait}>Poker-Raum erstellen</button></section>
        <section className="tile"><h2>Texas Hold'em</h2><p>Echtes Hold'em mit Blinds, Erhöhen und All-in, bis zu 9 Spieler.</p><button className="btn" onClick={() => create('holdem')} disabled={wait}>Hold'em-Raum erstellen</button></section>
        <section className="tile"><h2>Raum beitreten</h2><p>Gib den Code deines Freundes ein.</p>
          <div className="row"><input value={input} onChange={e => setInput(e.target.value.toUpperCase())} maxLength={5} placeholder="CODE" aria-label="Raumcode" style={{ width: '7rem', textTransform: 'uppercase' }} />
            <button className="btn" onClick={join} disabled={wait || input.trim().length < 5}>Beitreten</button></div></section>
      </div>
      {err && <p className="muted">{err}</p>}
    </main>
  )
  const host = room.host === p.id, poker = room.game === 'poker', shown = revealed === room.round && room.phase === 'result'
  const ready = id => (poker ? room.seats.some(s => s.user_id === id && s.done) : room.bets.some(b => b.user_id === id))
  return (
    <main className="table-page">
      <div className="room-head">
        <div><small className="muted">{room.game === 'holdem' ? "Texas Hold'em" : poker ? 'Poker-Raum' : 'Roulette-Raum'}, Code</small><div className="room-code">{room.code}</div></div>
        <div className="row"><button className="btn sm ghost" onClick={() => navigator.clipboard?.writeText(room.code)}>Code kopieren</button><button className="btn sm ghost" onClick={leave}>{host ? 'Raum schließen' : 'Verlassen'}</button></div>
      </div>
      <div className="members">{room.members.map(m => <span key={m.user_id} className={'member' + (ready(m.user_id) ? ' ok' : '')}>
        {m.name}{m.user_id === room.host ? ' (Gastgeber)' : ''}{ready(m.user_id) ? ' ✓' : ''}</span>)}</div>
      {room.game === 'holdem' ? <HoldemRoom room={room} act={act} busy={wait} /> : poker ? <PokerRoom room={room} act={act} busy={wait} /> : <>
        <Roulette room={room} onBet={b => call('room_bet', { p_code: room.code, p_bets: b })} onDone={setRevealed} />
        <div className="row center">
          {host && room.phase === 'betting' && <button className="btn" onClick={() => act('room_spin')} disabled={wait || !room.bets.length}>Kugel rollen lassen</button>}
          {host && shown && <button className="btn" onClick={() => act('room_next')} disabled={wait}>Nächste Runde</button>}
        </div>
        <p className="muted center-t">{room.phase === 'betting' ? (host ? 'Warte, bis alle gesetzt haben (✓), dann starte die Kugel.' : 'Setze deine Chips und gib deine Wetten ab. Der Gastgeber startet die Kugel.') : shown ? '' : 'Die Kugel rollt …'}</p>
        {shown && <table className="stats"><thead><tr><th>Spieler</th><th>Einsatz</th><th>Auszahlung</th></tr></thead><tbody>
          {room.payouts.map(x => <tr key={x.user_id} className={Number(x.pay) > Number(x.stake) ? 'me' : ''}><td>{x.name}</td><td>{x.stake} NC</td><td>{x.pay} NC</td></tr>)}</tbody></table>}
      </>}
      {err && <p className="muted center-t">{err}</p>}
    </main>
  )
}
